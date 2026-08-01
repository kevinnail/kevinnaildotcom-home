# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

Two npm packages, each with its own `package.json`, lint/format/test setup:

- **`/`** — the Vite React frontend (`src/`).
- **`server/`** — the Express + Postgres API.
- **`lambda/`** — the retired AWS Lambda that the server replaced. Kept for reference; not deployed. See "Historical Evolution".
- **`legacy/`** — the original hand-written static HTML/CSS version of the site, pre-React. Reference only.
- **`current-workflow/`**, **`server/BE-current-workflow/`** — the vertical-slice plan documents the build followed.

## Build & Dev Commands

Frontend (repo root):

```bash
npm start         # Vite dev server (port 5173)
npm run build     # Production build (outputs to dist/)
npm run preview   # Preview production build locally
npm run lint      # ESLint
npm run format    # Prettier --write
npm test          # Vitest (run once); npm run test:watch to watch
```

Backend (`server/`):

```bash
npm run dev            # node --watch, loads .env via dotenv
npm start              # production start
npm run setup-db       # DROPs and recreates all tables from sql/setup.sql
npm run setup-test-db  # same against the test database
npm run create-admin   # scripts/create-admin.js — seeds an admin user
npm run lint / format / test
```

The schema is **drop-and-recreate**, not migrated. `server/sql/setup.sql` is the single source of truth; every table has a `DROP TABLE IF EXISTS ... CASCADE` above its `CREATE TABLE`. Changing the schema means editing that file and re-running `npm run setup-db`. There is no migration tool and there should not be one.

Local Postgres, always. Dev and test use separate databases; `.env` and `.env.test` are separate. Do not create a `.env.example`.

## Architecture

A React SPA (Vite 6, React 18, React Router 7, Tailwind v4) plus an Express 5 API backed by Postgres, with media stored in S3 and served through CloudFront.

Three tiers, and the split matters:

1. **Static marketing content** — projects, home cards, contact links — lives in plain JS arrays under `src/data/` and is imported directly by pages. No API involved.
2. **Gallery content** — astrophotography photos, backpacking photos, KML trips — is dynamic, lives in Postgres, and is fetched at runtime through `src/lib/mediaApi.js`.
3. **Media bytes** — the images and KML files themselves — live in S3 and are never served by, or passed through, the Express server.

### Upload path: presigned direct-to-S3

This is the most important thing to understand before touching upload code. **Image bytes never pass through the Express server.**

1. Admin signs in → `POST /api/v1/users/sessions` → server verifies the scrypt hash and returns a JWT. The token is held in `sessionStorage` (never `localStorage`) and exposed app-wide via `useAdminToken()` in `src/lib/adminSession.js`, which wraps `useSyncExternalStore`.
2. Client asks for an upload slot → `POST /api/v1/presign?gallery=<astro|hikes|kml>` with `Authorization: Bearer <token>`. The server validates the token, mints a uuid object key, and uses **its own IAM role** to sign an S3 `PutObject` URL (`server/lib/utils/s3.js`). TTL is 5 minutes.
3. Client `PUT`s the file **straight to S3** at that URL (`uploadToS3` in `src/lib/mediaApi.js`). The `content-type` and `cache-control` headers are signed into the URL and must be echoed verbatim or S3 rejects the PUT with a 403.
4. Client posts the resulting `objectKey` back to `POST /api/v1/photos` (or `/trips`) to write the database row.

The JWT authenticates the client **to the API**, not to S3. The presigned URL is itself the S3 credential — a narrow, time-boxed delegation of one write to one key. The browser never holds AWS credentials.

Consequences of this design that show up throughout the code:

- The server cannot inspect or transform image bytes, so **thumbnails are generated in the browser** (`src/lib/thumbnail.js`, canvas + `createImageBitmap`) and **EXIF is read in the browser** (`src/lib/exif.js`, via `exifr`). Both upload as ordinary files through the same presign path.
- Steps 3 and 4 are **not atomic**. A client that dies between them leaves an S3 object with no row pointing at it. See "Orphaned S3 objects".
- Rows store the full public CloudFront URL, not the key. `mediaUrl()` / `objectKeyFromUrl()` in `server/lib/utils/s3.js` convert between them; deletes derive the key back out of the stored URL.

### API

Mounted under `/api/v1` in `server/lib/app.js`:

- `health`, `users` (login), `presign`, `photos`, `trips`

Standard controller → model → `pg` pool layering (`server/lib/{controllers,models,utils}`). Gallery-scoped routes take `?gallery=`, validated against an allowlist by `server/lib/utils/gallery.js` — an unknown gallery is a 400, never a silent default. `authenticate` middleware turns every token failure into a 401, which the client converts into `SessionExpiredError` and forces a re-login. Errors propagate to `middleware/error.js`; nothing is swallowed.

### Data model

`server/sql/setup.sql`:

- `users_admin` — single admin, scrypt `password_hash`.
- `trips` — a KML trail/campsite file: `name`, `region`, `url`.
- `photos` — `gallery` ('astro' | 'hikes'), `url`, `thumb_url` (hikes only), `alt`, `caption`, `lat`/`lng`, `taken_at` (EXIF capture time), `trip_id` (FK → `trips`, `ON DELETE CASCADE`), `sort_order`.

Ordering differs per gallery and is done server-side: **astro** uses hand-curated `sort_order`; **hikes** sorts chronologically by `taken_at`, falling back to `uploaded_at`. Deleting a trip cascades to its photos in the database and also purges their S3 objects.

### Routing

Routes in `src/App.jsx`, all wrapped in `PageWrapper` (scroll-to-top on navigation):

- `/` → HomePage
- `/projects` → ProjectsPage
- `/astrophotography` → AstrophotographyPage
- `/backpacking` → **HikeMapPage** (the 3D Cesium globe)
- `/backpacking/gallery` → BackpackingPage (the flat grid)
- `/dashboard` → DashboardPage (admin)
- `/*` → NotFoundPage

### Component Organization

Under `src/components/`:

- `layout/` — PageWrapper, Banner, ScrollToTop, AdminLinkRow
- `home/` — CardGrid, Card
- `projects/` — ProjectList, ProjectCard, AnchorNav, BioSection, ContactLinks, SectionHeader, SectionEyebrow, ResumeEmbed, DiagramsSection, DecodeText
- `astrophotography/` — GalleryGrid, GalleryItem, LightboxModal (the grid is reused by the backpacking gallery via a `fetchPhotos` prop)
- `hikes/` — HikeGlobe (Cesium/Resium), MapSidebar, HikePhotoDock, HikeCoachMarks
- `dashboard/` — LoginForm, UploadForm, BulkUploadForm, KmlUploadForm, PhotoList, HikeTripList

Shared client logic in `src/lib/`: `mediaApi` (all API + S3 calls), `adminSession`, `thumbnail`, `exif`, `hikePhotos`, `concurrency` (bounded parallelism for bulk upload), `useIsDesktop`.

### Map

The backpacking map is Cesium via Resium, bundled with `vite-plugin-cesium`. KML trip files are uploaded through the same presign path (`?gallery=kml`, extension-restricted to `.kml`) and loaded by the globe from their CloudFront URL.

### Styling

Tailwind CSS v4 via the Vite plugin (`@tailwindcss/vite`). Custom theme in `src/index.css` under `@theme`:

- Custom colors: `neon-blue`, `neon-blue-50`, `mid-gray`
- Custom fonts: `display` (Josefin Slab), `body` (Open Sans) — loaded via Google Fonts in `index.html`
- Custom keyframe animations: `ocean`, `zoom`

### SEO

`react-helmet-async` provides per-page `<title>`, `<meta description>`, `<link rel="canonical">`. `HelmetProvider` wraps the app in `main.jsx`.

### Static Assets

Site chrome images live in `public/images/`. Gallery media and project videos are served from CloudFront. `public/.htaccess` handles SPA fallback routing.

### Testing

Vitest on both sides. Server tests (`server/__tests__/`) are integration tests using `supertest` against a **real local test database**, reset per test via `setup-test-db`. Frontend tests are unit tests for pure logic (`thumbnail`, `hikePhotos`, `concurrency`). Mocks are reserved for third-party services that cost money or send real messages — never for the data layer.

## Known Gaps

### Orphaned S3 objects — known, measured, and deliberately not fixed

Because the byte upload (step 3) and the row write (step 4) are separate requests, an interrupted upload leaves an unreferenced object in the bucket: invisible to the app, billable forever. The worst case is bulk upload (`BulkUploadForm.jsx`), which PUTs every original and thumbnail to S3 before a single `savePhotosBatch` call — one failed save can orphan up to 1000 objects.

**The standard fix was evaluated and rejected.** That fix is: sign a `lifecycle=pending` tag into the presigned PUT (via `signableHeaders`, since the SDK otherwise hoists `x-amz-tagging` to the query string where S3 ignores it), call `DeleteObjectTagging` once the row commits, and set a bucket lifecycle rule expiring anything still tagged `pending`.

It is not being implemented because the numbers don't justify it. Even the 1000-object worst case is ~2.5 GB, roughly **$0.70/year**. Against that, the change touches `s3.js`, `mediaApi.js`, three controllers and their tests, and creates a failure mode where a bug in the tag-clearing path silently deletes live gallery photos 24 hours later — which a bucket policy cannot prevent, since lifecycle rules run outside the policy layer. This is a single-admin personal site; the pattern is correct for multi-tenant scale and ceremony here.

If orphans ever need auditing, the right tool is a manual read-only script that lists the prefixes, diffs against the `url`/`thumb_url` columns, and prints what's unreferenced — not automated deletion.

## Historical Evolution

Worth knowing, because a lot of the current shape is inherited from the constraints of earlier versions.

**v1 — hand-written static site** (`legacy/`): plain HTML and CSS, no build step.

**v2 — React SPA, fully static:** Vite + React + Tailwind, all content as JS arrays in `src/data/`. No backend, no database, no dynamic content. Deployed as static files.

**v3 — serverless, Lambda + JSON manifest** (`lambda/`): to make the galleries admin-editable without running a server, a single AWS Lambda behind a function URL handled login, presigning, and gallery CRUD. There was no database — a **JSON manifest file in S3** was the database, and `lambda/lib.mjs` is entirely pure array transforms over it (`addPhoto`, `removePhoto`, `reorderPhotos`, `partitionPhotosByTrip`). Auth was a **hand-rolled HS256 JWT** and scrypt hashing built on Node's `crypto`, specifically to keep the Lambda dependency-free.

Direct-to-S3 upload originated here and was **not a preference — it was forced.** Lambda's synchronous request payload cap is 6 MB; a raw astro exposure exceeds that, so routing bytes through the function was never possible. Presigning was the only option.

**v4 — current, Express + Postgres** (`server/`): the Lambda was ported to a conventional Express API with a real relational schema. The JSON manifest became the `photos`/`trips` tables (array position → `sort_order`, and `partitionPhotosByTrip` became a foreign key with `ON DELETE CASCADE`). Hand-rolled JWT/scrypt became `jsonwebtoken` and `server/lib/utils/password.js`. ESLint, Prettier, and Vitest were added on both sides.

**What deliberately did not change:** the upload path. `server/lib/utils/s3.js` is a direct port of the Lambda's `handlePresign`, and browsers still `PUT` bytes straight to S3. The 6 MB constraint that originally forced it is gone — Express could accept multipart bodies via `multer` — but the pattern was kept because it avoids doubling bandwidth, keeps large bulk uploads off the server entirely, and was already built and tested. The cost of keeping it is that the server cannot validate or transform image bytes (hence browser-side thumbnails and EXIF) and that uploads are non-atomic (hence the orphan gap above).
