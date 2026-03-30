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

- Homepage loads with the expected section order
- Upcoming shows content and links stay correct
- The previous-video thumbnail remains while the old text stays removed
- Mobile layout does not introduce horizontal overflow
- `script.js` behaviors including:
  - logo fallback on image error
  - ripple creation and cleanup
  - section animation initialization
  - hover transition binding for all video containers

## Continuous Integration

GitHub Actions runs the same test suite on every push and pull request:

- installs Node 24 dependencies with `npm ci`
- installs Chromium for Playwright
- runs `npm test`
- uploads Playwright artifacts if the browser suite fails

## File Structure

```text
RadDad Website/
|-- .github/workflows/test.yml
|-- index.html
|-- styles.css
|-- script.js
|-- tests/
|   |-- e2e/homepage.spec.js
|   |-- setup/vitest.setup.js
|   `-- unit/homepage.test.js
|-- playwright.config.js
|-- vitest.config.js
|-- package.json
`-- README.md
```
