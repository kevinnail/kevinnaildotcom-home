# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # Production build (outputs to dist/)
npm run preview   # Preview production build locally
```

No test framework, linter, or formatter is configured.

## Architecture

This is a static React portfolio site (no backend/API) built with Vite 6, React 18, React Router 7, and Tailwind CSS v4.

### Routing

Routes are defined in `src/App.jsx`. All routes are wrapped with `PageWrapper` (handles scroll-to-top on navigation):
- `/` → HomePage
- `/projects` → ProjectsPage
- `/astrophotography` → AstrophotographyPage
- `/*` → NotFoundPage

### Data Pattern

All content is static JS arrays in `src/data/` — no API calls or state management library. Components receive data via props. Pages import data directly from these modules.

### Component Organization

Components are grouped by feature under `src/components/`:
- `layout/` — PageWrapper, Banner, ScrollToTop (shared across pages)
- `home/` — CardGrid, Card
- `projects/` — ProjectList, ProjectCard, AnchorNav, BioSection, ContactLinks, SectionHeader, ResumeEmbed, DiagramsSection
- `astrophotography/` — GalleryGrid, GalleryItem, LightboxModal

### Styling

Tailwind CSS v4 configured via the Vite plugin (`@tailwindcss/vite`). Custom theme defined in `src/index.css` with `@theme` directive:
- Custom colors: `neon-blue`, `neon-blue-50`, `mid-gray`
- Custom fonts: `display` (Josefin Slab), `body` (Open Sans) — loaded via Google Fonts in `index.html`
- Custom keyframe animations: `ocean`, `zoom`

### SEO

`react-helmet-async` provides per-page `<title>`, `<meta description>`, and `<link rel="canonical">` tags. The HelmetProvider wraps the app in `main.jsx`.

### Static Assets

Images live in `public/images/`. Some project videos are served from CloudFront. The `.htaccess` in `public/` handles server-side routing for SPA deployment.
