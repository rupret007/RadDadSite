# Rad Dad Band Website

Static one-page website for Rad Dad, a pop punk cover band.

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
- Recent-set artist and song showcase, 2026 show history, videos, and stable contact/social links
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
|-- index.html
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
