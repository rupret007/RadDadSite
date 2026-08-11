# Rad Dad Band Website

Static website for Rad Dad, a pop punk cover band. The site includes the main
band page and a music-first `/tap/` landing page reached from QR stickers on Rad
Dad's 3D-printed cassette, floppy disk, VHS, and collectible promotional items.

## QR Landing Page

The current physical promotion workflow uses a **1-inch round matte-white
sticker with a solid-black QR code**. The sticker is installed on the protected
rear or underside landing of each printed item and opens:

`https://raddadband.com/tap/`

The current products do not contain NFC hardware. The landing page should focus
on the band and its music rather than explaining how the visitor arrived. The
legacy `/nfc` and `/nfc/` routes continue to redirect to `/tap/` only so old
links do not break.

See [docs/QR_LANDING_PAGE.md](./docs/QR_LANDING_PAGE.md) for the physical QR
specification, copy guardrails, and routing notes.

## Local Preview

1. Open [index.html](./index.html) directly in a browser for a quick preview.
2. Use the automated test server when you want to exercise the site through Playwright.

## Automated Testing

The repo now includes a hybrid automated test suite:

- `Vitest + JSDOM` for `script.js` behavior
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

### What The Suite Covers

- Event-first section and focus order, page metadata, and structured event data
- September 19 event facts, flyer assets, calendar download, and directions
- Flyer-style recent-set artist wall, 2026 show history, videos, and stable contact/social links
- Mobile flyer prominence, uncropped aspect ratio, and horizontal-overflow prevention
- Desktop flyer-and-event-copy presentation
- Logo fallback behavior when the brand image cannot load

## Continuous Integration

GitHub Actions runs the same test suite on every push and pull request:

- installs Node 24 dependencies with `npm ci`
- installs Chromium for Playwright
- runs `npm test`
- uploads Playwright artifacts if the browser suite fails

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
|   `-- QR_LANDING_PAGE.md
|-- index.html
|-- tap/
|   |-- index.html
|   |-- styles.css
|   `-- script.js
|-- styles.css
|-- script.js
|-- scripts/build-sites.mjs
|-- tests/
|   |-- e2e/homepage.spec.js
|   |-- setup/vitest.setup.js
|   `-- unit/homepage.test.js
|-- playwright.config.js
|-- vitest.config.js
|-- package.json
|-- worker/index.js
`-- README.md
```
