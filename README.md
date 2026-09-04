# Rad Dad Band Website

Static website for Rad Dad, a pop punk cover band. The site includes the main
band page and a music-first `/qr/` landing page reached through the permanent
printed-QR URL `/tap/`.

The current September 19, 2026 show remains branded **Rad Dad + Friends** and
runs from **7–10 PM** at Guitars & Growlers in Richardson. **The Fault Lines**
are named as a participating band on the homepage, QR landing page, calendar
download, and structured event metadata. The restored Friends flyer and visual
treatment remain the source of truth; do not infer billing order or set times.

## Public Show-Night Board

The homepage and `/qr/` landing page both connect fans to the same public
[Rad Dad show-night board](https://rad-dad-show-night.jeffstory007.chatgpt.site/).
The two focused actions deep-link to the current running order and public song
suggestions without adding either destination to the already-compact site
navigation.

Suggestions are review-only: submitting an idea never changes the official
show automatically. The public site links only to `#official-sets` and
`#suggestions`; it must never expose the owner-only `/show-control` route. The
show-night app remains the canonical source for running-order and suggestion
data, so this static repository must not copy those records.

On `/qr/`, a normal tap on a verified-embeddable Wildflower performance opens
a focused inline player so a fan can watch without losing their place in the
song-to-show path. The privacy-enhanced YouTube frame is created only after
that explicit tap. Videos that YouTube does not permit to embed—including the
current featured upload—stay clearly labeled direct YouTube links instead of
opening a broken player. Every card remains a real `youtube.com` link, so
modified clicks, browsers without the dialog API, and visits without
JavaScript keep the direct YouTube fallback.

## QR Landing Page

The current physical promotion workflow uses a **1-inch round matte-white
sticker with a solid-black QR code**. The sticker is installed on the protected
rear or underside landing of each printed item and uses the permanent URL:

`https://raddadband.com/tap/`

`/tap/` redirects to the canonical `/qr/` landing page. It is printed on
physical QR codes and must never be removed or repurposed. A static redirect
page is retained alongside the Worker redirect so the URL works on either
deployment path.

The current products do not contain NFC hardware. The landing page should focus
on the band and its music rather than explaining how the visitor arrived. The
legacy `/nfc` and `/nfc/` routes continue to redirect to `/qr/` only so old
links do not break. `/qr/` is the single content source for `/tap/` and those
legacy NFC aliases; the alias pages contain redirects, not duplicate music
content.

See [docs/QR_LANDING_PAGE.md](./docs/QR_LANDING_PAGE.md) for the physical QR
specification, copy guardrails, and routing notes.

## Local Preview

1. Open [index.html](./index.html) directly in a browser for a quick preview.
2. Use the automated test server when you want to exercise the site through Playwright.

## Automated Testing

The repo now includes a hybrid automated test suite:

- `Vitest + JSDOM` for `script.js` behavior
- artifact and deployment-helper safety tests for clean releases and rollback
- `Playwright` for real-browser homepage smoke coverage in Chromium

### Install

1. Install dependencies:

   ```bash
   npm install
   ```

2. Install the Playwright Chromium browser once:

   ```bash
   npm run test:install-browsers
   ```

If Windows PowerShell blocks `npm` or `npx`, use `npm.cmd` and `npx.cmd` instead.

### Test Commands

- Build the deployable Sites package:

  ```bash
  npm run build:sites
  ```

- Build and verify the clean production-only package:

  ```bash
  npm run build:production
  npm run verify:production -- --expected-sha YOUR_40_CHARACTER_GIT_SHA
  ```

- Run the full suite:

  ```bash
  npm test
  ```

- Run unit tests only:

  ```bash
  npm run test:unit
  ```

- Run browser smoke tests only:

  ```bash
  npm run test:e2e
  ```

- Run the server deployment-helper tests only:

  ```bash
  npm run test:deploy
  ```

- Lint the deployment helper and its shell test harness (requires ShellCheck):

  ```bash
  npm run lint:deploy
  ```

### What The Suite Covers

- Event-first section and focus order, page metadata, and structured event data
- September 19 event facts, named participating bands, flyer assets, calendar download, and directions
- Flyer-style recent-set artist wall with show and listen paths, homepage Story Of Us listen desk, leftover show-tape and QR listen loops, 2026 show history, videos, and stable contact/social links
- Review-only fan participation links shared by the homepage and canonical QR landing page
- Public HTML never exposing `/show-control`, board links limited to `#official-sets` and `#suggestions`, and the Worker failing closed on owner-only `/show-control` paths
- The latest featured YouTube performance on both the homepage and canonical QR landing page
- Progressive inline playback for verified-embeddable `/qr/` videos, including privacy-delayed loading, honest direct-only cards, close cleanup, and focus return
- Permanent `/tap/` and legacy `/nfc/` fallbacks converging on the canonical `/qr/` content
- Mobile flyer prominence, uncropped aspect ratio, and horizontal-overflow prevention
- Desktop flyer-and-event-copy presentation
- Logo fallback behavior when the brand image cannot load

## Continuous Integration

GitHub Actions runs the same test suite on every push and pull request:

- installs Node 24 dependencies with `npm ci`
- installs Chromium for Playwright
- runs `npm test`
- runs ShellCheck against the deployment helper and its shell test harness
- builds and verifies a clean, commit-identified production artifact containing
  the homepage, canonical `/qr/` content, permanent `/tap/` alias, and legacy
  `/nfc/` fallback
- uploads Playwright artifacts if the browser suite fails

Pull requests cannot deploy and do not receive production credentials. The
remote production job is disabled by default behind explicit discovery,
branch/reviewer, shared-vhost-intent, and master enablement gates. Automatic
deployment has its own additional disabled-by-default switch.

## Production Deployment

The guarded production path publishes only the verified `dist/client`
artifact, never the complete repository. Its first production cutover has
**not** completed. The current legacy `raddadband.com` root still exposes
repository-only paths such as package metadata, tests, backups, and historical
ZIP files. Do not describe the live server as clean-artifact-only until public
`version.json`, `artifact-manifest.json`, and `SHA256SUMS` identify one verified
release and every forbidden-path probe returns HTTP 404.

GitHub Pages and the existing ChatGPT Sites deployment remain separate from
this guarded server path. Merging code does not authorize Che's server cutover,
remove legacy files, or change either independent deployment.

See [the production deployment runbook](docs/production-deployment.md) for the
mandatory hosting discovery record, `raddadband.com` / `lazypunksunite.com`
vhost decision, protected branch and Environment reviewer setup, first rollout,
health verification, rollback drill, and kill switches. No server action is
authorized merely by merging the pipeline.

## File Structure

```text
RadDad Website/
|-- .gitattributes
|-- .github/workflows/test.yml
|-- .openai/hosting.json
|-- assets/
|   |-- rad-dad-friends-guitars-growlers-2026-561.webp
|   |-- rad-dad-friends-guitars-growlers-2026-1122.webp
|   |-- rad-dad-friends-guitars-growlers-2026-full.png
|   |-- rad-dad-friends-guitars-growlers-2026.ics
|   |-- rad-dad-social-2026.png
|   `-- wildflower-2026-poster-720.webp
|-- docs/
|   |-- production-deployment.md
|   |-- QR_LANDING_PAGE.md
|   `-- raddad-deploy.conf.example
|-- index.html
|-- nfc/
|   `-- index.html
|-- qr/
|   |-- index.html
|   |-- script.js
|   `-- styles.css
|-- tap/
|   `-- index.html
|-- styles.css
|-- script.js
|-- scripts/
|   |-- build-sites.mjs
|   |-- deploy/server-deploy.sh
|   |-- lib/production-artifact.mjs
|   `-- verify-production-artifact.mjs
|-- tests/
|   |-- deploy/server-deploy.test.sh
|   |-- e2e/homepage.spec.js
|   |-- setup/vitest.setup.js
|   |-- unit/homepage.test.js
|   `-- unit/production-artifact.test.js
|-- playwright.config.js
|-- vitest.config.js
|-- package.json
|-- worker/index.js
`-- README.md
```
