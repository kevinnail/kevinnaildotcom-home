# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

Two npm packages, each with its own `package.json`, lint/format/test setup:

- **`/`** — the Vite React frontend (`src/`).
- **`server/`** — the Express + Postgres API.
- **`lambda/`** — the retired AWS Lambda that the server replaced. Kept for reference; not deployed. See "Historical Evolution".
- **`legacy/`** — the original hand-written static HTML/CSS version of the site, pre-React. Reference only.
- **`current-workflow/`**, **`server/BE-current-workflow/`** — the vertical-slice plan documents the build followed.
- **`docs/plans/`** — where plans live now. A new plan is written to `docs/plans/pending/<short-name>.md`; once it is built and Kevin has signed off, it moves to `docs/plans/completed/`. Every plan for this project goes here, not in `~/.claude/plans`. `docs/` is gitignored.

## Build & Dev Commands

Frontend (repo root):

```bash
npm start         # Vite dev server (port 5173)
npm run build     # Production build (outputs to dist/)
npm run preview   # Preview production build locally
npm run lint      # ESLint
npm run format    # Prettier --write
npm test          # Vitest (run once); npm run test:watch to watch
npm run build-geology  # Rebuild public/data/geology/ from geology-source/ (needs GDAL; see "Geology layer")
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
2. **Gallery content** — astrophotography photos, backpacking photos, KML trips — is dynamic, lives in Postgres, and is fetched at runtime through `src/api/mediaApi.js`.
3. **Media bytes** — the images and KML files themselves — live in S3 and are never served by, or passed through, the Express server.

### Upload path: presigned direct-to-S3

This is the most important thing to understand before touching upload code. **Image bytes never pass through the Express server.**

1. Admin signs in → `POST /api/v1/users/sessions` → server verifies the scrypt hash and returns a JWT. The token is held in `sessionStorage` (never `localStorage`) and exposed app-wide via `useAdminToken()` in `src/hooks/adminSession.js`, which wraps `useSyncExternalStore`.
2. Client asks for an upload slot → `POST /api/v1/presign?gallery=<astro|hikes|kml|blog>` with `Authorization: Bearer <token>`. The server validates the token, mints a uuid object key, and uses **its own IAM role** to sign an S3 `PutObject` URL (`server/lib/utils/s3.js`). TTL is 5 minutes.
3. Client `PUT`s the file **straight to S3** at that URL (`uploadToS3` in `src/api/mediaApi.js`). The `content-type` and `cache-control` headers are signed into the URL and must be echoed verbatim or S3 rejects the PUT with a 403.
4. Client posts the resulting `objectKey` back to `POST /api/v1/photos` (or `/trips`) to write the database row.

The JWT authenticates the client **to the API**, not to S3. The presigned URL is itself the S3 credential — a narrow, time-boxed delegation of one write to one key. The browser never holds AWS credentials.

Consequences of this design that show up throughout the code:

- The server cannot inspect or transform image bytes, so **all image resizing happens in the browser** (`src/utils/resizeImage.js`, canvas + `createImageBitmap`) and **EXIF is read in the browser** (`src/utils/exif.js`, via `exifr`). Both upload as ordinary files through the same presign path.
- Steps 3 and 4 are **not atomic**. A client that dies between them leaves an S3 object with no row pointing at it. See "Orphaned S3 objects".
- Rows store the full public CloudFront URL, not the key. `mediaUrl()` / `objectKeyFromUrl()` in `server/lib/utils/s3.js` convert between them; deletes derive the key back out of the stored URL.

### Image sizing — the two galleries are deliberately different

**Astro uploads the camera original, untouched.** Those images are detail-critical — fine structure is the whole point — and the gallery will stay small enough that page weight never becomes the problem. Do not route astro through `resizeImage.js`.

**Hikes never uploads the original.** A trip is hundreds of photos browsed by stepping through them on the map, so weight is the dominant cost. `BulkUploadForm` derives two renditions in the browser and uploads only those: a 2048px WebP display image (`url`) and a 400px WebP thumbnail (`thumb_url`). The original is a local source file and is never stored — masters live on the photographer's disk, not in S3.

This is a canvas re-encode, which is the old "Save for Web" pipeline: EXIF, ICC, and the embedded preview are all dropped, and the 2D context is sRGB so a wide-gamut source is converted on the way through. Two consequences worth knowing:

- `readPhotoMeta` must run on the **original**, before the resize, or GPS and `takenAt` are gone. The published file no longer carries campsite coordinates, which is a privacy win, not a bug.
- `createImageBitmap` is called with an explicit `imageOrientation: 'from-image'`. Canvas output has no EXIF, so an orientation flag that isn't baked into the pixels at resize time is lost permanently and the photo ships sideways.

`HikeMapPage` prefetches the display image of the photos on either side of the open one (`src/utils/preloadImages.js`), because stepping with the arrows otherwise starts a cold fetch on click.

### API

Mounted under `/api/v1` in `server/lib/app.js`:

- `blog`, `health`, `users` (login), `presign`, `photos`, `trips`. `blog` keeps its admin reads under `/admin`, declared above `/:slug`, so the slug `admin` is reserved.

Standard controller → model → `pg` pool layering (`server/lib/{controllers,models,utils}`). Gallery-scoped routes take `?gallery=`, validated against an allowlist by `server/lib/utils/gallery.js` — an unknown gallery is a 400, never a silent default. `authenticate` middleware turns every token failure into a 401, which the client converts into `SessionExpiredError` and forces a re-login. Errors propagate to `middleware/error.js`; nothing is swallowed.

### Data model

`server/sql/setup.sql`:

- `users_admin` — single admin, scrypt `password_hash`.
- `trips`: a KML trail/campsite file: `name`, `region`, `url`, plus route stats (`distance_miles`, `elevation_min_feet`, `elevation_max_feet`, `elevation_gain_feet`, `elevation_loss_feet`, and `elevation_profiles` JSONB). The six stats columns are all set or all null; null means the KML has no route line, or the trip predates stats and hasn't been measured. The API returns them as one `stats` object, or `stats: null`.
- `photos` — `gallery` ('astro' | 'hikes'), `url`, `thumb_url` (hikes only), `alt`, `caption`, `lat`/`lng`, `taken_at` (EXIF capture time), `trip_id` (FK → `trips`, `ON DELETE CASCADE`), `sort_order`.
- `blog_posts`: `slug` (unique, set from the title at creation and never changed), `title`, `category` (free text; a new one that differs from an existing one only in case reuses the existing spelling), `summary`, `cover_url`, `blocks` (JSONB), `published_at` (null means draft).
- `blog_images`: `post_id` (FK → `blog_posts`, `ON DELETE CASCADE`), `url`. One row per photo uploaded to a post; images blocks store only `imageId` and `caption`, and reads add each `url`. A save deletes the rows its blocks no longer use and purges their S3 objects.
- `blog_retired_slugs`: `slug`. Deleting a post adds its slug here, and new posts never take one, so an old link never opens a different post.

Ordering differs per gallery and is done server-side: **astro** uses hand-curated `sort_order`; **hikes** sorts chronologically by `taken_at`, falling back to `uploaded_at`. Trips sort newest first by their earliest photo on that same date, and trips with no photos yet go last, newest upload first. Deleting a trip cascades to its photos in the database and also purges their S3 objects.

### Routing

Routes in `src/App.jsx`, all wrapped in `PageWrapper` (scroll-to-top on navigation):

- `/` → HomePage
- `/projects` → ProjectsPage
- `/astrophotography` → AstrophotographyPage
- `/backpacking/:tripId?` → **HikeMapPage** (the 3D Cesium globe). The selected hike is the URL's trip id, so a hike can be linked directly; no id is the all-hikes overview, and an id that matches no trip shows "Hike not found." over the overview. One route with an optional segment, so switching hikes never remounts the globe.
- `/blog` → BlogPage (published posts, `?category=` filter)
- `/blog/:slug` → BlogPostPage (a published post; unknown or draft slugs render NotFoundPage)
- `/dashboard` → DashboardPage (admin)
- `/dashboard/blog/:id` → BlogEditorPage (admin): one blog post's editor. Its state lives in the Zustand store `src/stores/blogEditorStore.js`.
- `/*` → NotFoundPage

### Component Organization

Under `src/components/`:

- `layout/` — PageWrapper, Banner, ScrollToTop, AdminLinkRow
- `home/` — CardGrid, Card
- `blog/`: BlogPostBody (renders a post's blocks; shared by BlogPostPage and the editor preview)
- `projects/` — ProjectList, ProjectCard, AnchorNav, BioSection, ContactLinks, SectionHeader, SectionLabel, ResumeEmbed, DiagramsSection, DecodeText
- `astrophotography/` — GalleryGrid, GalleryItem, LightboxModal (astro only; there is deliberately no flat grid for the hikes — they are browsed on the map)
- `hikes/`: HikeGlobe (Cesium/Resium), MapSidebar, HikePhotoDock, HikeCoachMarks, HikeInfoPanel, ElevationProfile, GeologyLayer, GeologySection
- `dashboard/` — LoginForm, UploadForm, BulkUploadForm, KmlUploadForm, PhotoList, HikeTripList, BlogAdmin

Shared client logic, split by role (there is deliberately no frontend `lib/`, so nothing shares a folder name with `server/lib/`):

- `src/api/`: `mediaApi` (every call to the Express API and every S3 upload).
- `src/hooks/`: `useIsDesktop`, `adminSession` (`useAdminToken` plus `signIn`/`signOut`).
- `src/stores/`: `blogEditorStore` (Zustand; the blog editor's title, category, summary, and blocks, with every block change as an action).
- `src/utils/`: `resizeImage`, `exif`, `hikePhotos`, `kmlLocation`, `preloadImages`, `concurrency` (bounded parallelism for bulk upload), `trackPointer`, `resumePdf`, `cesiumIon` (sets the Ion token; imported for its side effect), `routeStats`, `routeElevations`, `routeFormat`, `geologyAge`, `geologyAgeWindows`.

### Map

The backpacking map is Cesium via Resium, bundled with `vite-plugin-cesium`. KML trip files are uploaded through the same presign path (`?gallery=kml`, extension-restricted to `.kml`) and loaded by the globe from their CloudFront URL.

Opening a hike shows `HikeInfoPanel` in the globe's top-right corner: the trip's name, region, route stats, and one `ElevationProfile` chart per route line, each spanning its own line's lowest to highest point with labeled height lines. It starts open on desktop and collapsed on a phone, and on a phone it steps aside while the photo dock is open.

### Route stats

Distance and elevation are measured **in the browser**, once, when the KML is uploaded, and stored on the trip. The server never reads KML bytes, so it only validates the shape (`server/lib/utils/routeStats.js`, `requireRouteStats`) and stores it.

- `src/utils/routeStats.js` is pure and unit-tested. It parses the KML as text, keeping only LineStrings in Placemarks that are switched on (a `<visibility>0</visibility>` on the Placemark or any enclosing Folder or Document hides it, matching what the globe draws); points, polygons, and `gx:Track`s are not route. Each line is measured on its own and the totals add up, so the gap between two lines never counts as distance or climb. Lines are resampled every 100 ft (wider past 4,000 points), climb and descent only count once the trail moves 16 ft from its last turning point, and the stored profiles are thinned to 200 points shared between lines by length.
- `src/utils/routeElevations.js` (`measureKmlRoute`) gets ground heights from Cesium World Terrain, the same terrain the globe draws, in one request for every line. It returns null for a KML with no route line, and throws on a failed terrain tile rather than storing a profile with holes.
- `KmlUploadForm` measures before presigning, so a failed measurement stops the upload and never leaves a trip without stats or an orphaned KML. `POST /trips` requires the `stats` key: an object, or an explicit `null` for a KML with no route line. A missing key is a 400.
- Trips uploaded before stats existed show a "Compute route stats" button in `HikeTripList`. It fetches the stored KML, measures it, and saves through `PUT /api/v1/trips/:id/stats`, which only accepts a stats object.

### Geology layer

The globe has two toggleable overlays for the Three Sisters: geologic map units, and moraine crests colored by glaciation. Map units have three color modes: **each flow** (id `plate`, the default), which uses the printed USGS plate's own color for each of ~150 units so the globe matches the plate; **geologic era** (id `age`), which groups units into the source's epoch bands; and **years**, which colors each unit by its age in years, in nine stepped ranges narrowest where the ages bunch (20,000 to 40,000 years). The point is reading the hikes against the land they cross. The source is USGS SIM 3186 (Hildreth, Fierstein, and Calvert 2012), using the 2021 GeMS shapefile release (Peters and others, doi:10.5066/P9IYBCRI).

This is static published data, a fourth tier beside the three above: it lives as GeoJSON in `public/data/geology/`, committed, and never touches the API, the database, or S3.

- `scripts/build-geology.js` (`npm run build-geology`) reprojects the shapefiles with `ogr2ogr` (run through WSL on Windows), simplifies the polygons at 5 m, and writes `units.geojson` and `moraines.geojson`. Each polygon carries its unit code, age class, plate color, and years color. The raw source lives in `geology-source/`, which is gitignored and downloaded by hand.
- `src/utils/geologyAge.js` holds the classification the build and the layer both use. Geologic era mode colors by the source's **epoch label**, not a numeric date, because only about half the units have one. Surficial deposits and glacial ice sit outside the age ramp. An unrecognized label throws, so a source change fails the build instead of miscoloring.
- Years mode gets its ages from `src/utils/geologyAgeWindows.js`, which combines three sources: the source's lab-date table (`GeochronPoints`), ages written in the unit descriptions, and the layering between units. A unit with no date of its own is bracketed by the dated units above and below it. The last two sources live in `scripts/geology-age-evidence.json`, one entry per source sentence with its quote, reviewed by hand; relations the authors hedge ("probably", "apparently") are left out. A unit is only colored if its age is fixed or its bracket spans no more than 2.5x; bracketed ages draw at half the fill of dated ones, and the rest fall to a neutral. A relation that contradicts the dates throws, failing the build.
- The controls (`GeologySection`) live inside `HikeInfoPanel` and are offered only while a hike is open whose route touches `GEOLOGY_MAP_AREA` in `geologyAge.js`. `HikeGlobe` checks every route point once the KML loads, not the overview pin. Layers already switched on hide on a hike outside the map and come back on the next one inside it. A test checks that every coordinate in the built GeoJSON falls inside `GEOLOGY_MAP_AREA`, so a rebuild that widens the data fails it.
- `GeologyLayer` doesn't mount a layer until it is first switched on, so visitors who never open it never download it. It lowers itself to the bottom of the data source stack on load, because terrain-clamped features draw in data source order and the hike route must stay on top.

### Styling

**No new Tailwind. Write plain CSS.** Kevin has dropped Tailwind for this project: a spacing or size he wants to change should be one property in one obvious rule he can edit by hand, not a string of one-property utility classes. New components and new styling go in named classes in a CSS file (the way `.matrix-intro` and `.energize` are written in `src/index.css`), or an inline style for a one-off value. Existing Tailwind markup stays as it is; do not add utility classes to it, and do not convert it unless asked.

The existing markup uses Tailwind CSS v4 via the Vite plugin (`@tailwindcss/vite`). Custom theme in `src/index.css` under `@theme`:

- Custom colors: `neon-blue`, `neon-blue-50`, `mid-gray`
- Custom fonts: `display` (Josefin Slab), `body` (Open Sans) — loaded via Google Fonts in `index.html`
- Custom keyframe animations: `ocean`, `zoom`

### SEO

`react-helmet-async` provides per-page `<title>`, `<meta description>`, `<link rel="canonical">`. `HelmetProvider` wraps the app in `main.jsx`.

### Static Assets

Site chrome images live in `public/images/`. Gallery media and project videos are served from CloudFront. `public/.htaccess` handles SPA fallback routing.

### Testing

Vitest on both sides. Server tests (`server/__tests__/`) are integration tests using `supertest` against a **real local test database**, reset per test via `setup-test-db`. Frontend tests live in `src/__tests__/`, never beside the file they test, and are unit tests for pure logic (`resizeImage`, `hikePhotos`, `concurrency`, `kmlLocation`, `resumePdf`, `routeStats`, `routeFormat`, `geologyAge`, `geologyAgeWindows`). Mocks are reserved for third-party services that cost money or send real messages, never for the data layer.

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
