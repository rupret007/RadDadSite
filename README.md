# Rad Dad Band Website

Static one-page website for Rad Dad, a pop punk cover band.

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
- runs ShellCheck against the deployment helper and its shell test harness
- builds and verifies a clean, commit-identified production artifact
- uploads Playwright artifacts if the browser suite fails

Pull requests cannot deploy and do not receive production credentials. A
protected production job can deploy the exact artifact tested on `main`; it is
manual by default and automatic only after the controlled rollout has been
validated.

## Production Deployment

Che can clone the source repository without downloading a ZIP:

```bash
git clone https://github.com/rupret007/RadDadSite.git
```

The clone must remain outside Apache's public `DocumentRoot`. Production
publishes only the verified `dist/client` artifact, never the complete
repository.

See [the production deployment runbook](docs/production-deployment.md) for the
server layout, GitHub Environment settings, pinned SSH host key, first rollout,
health verification, rollback drill, and auto-deploy enablement.

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
|   |-- the-middle-jimmy-eat-world-thumbnail.webp
|   `-- wildflower-2026-poster-720.webp
|-- index.html
|-- styles.css
|-- script.js
|-- docs/
|   |-- production-deployment.md
|   `-- raddad-deploy.conf.example
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
