# Rad Dad band website

Rad Dad is a Dallas–Fort Worth **cover band**, playing pop-punk, punk and alternative favorites.
This branch is the October 24 design preview for Travis. Keep it off main and the established live site until Jeff requests publication. The September 19 show remains a dated history entry.

## Current public surfaces

- `/`: band introduction and featured live cover, “Do your homework” videos, arcade, covered artists, band members, a Taylor Swift cover recording, dated history, direct booking and social links.
- `/#hang-out`: an announcement and direct link to the shared Hang Out guest entrance. The staged link uses the standalone demo with `via=rad-dad`. Verify the shared app's Rad Dad return link, guest room invitations and advertised activities on the intended release before publishing.
- `/play/`: Rad Dad Arcade, with nine games, local records, optional sound effects and a route back to the band. No Stalemate recordings are included.
- `/qr/`: music-first landing page with accurate cover credits, the same five live-video destinations, follow links and a path back to the main booking section.
- `/tap/`: permanent printed-QR URL, still redirects to `/qr/`. Never remove or repurpose it.
- `/nfc/`: legacy compatibility alias for `/qr/`; the current physical items use printed QR codes rather than NFC hardware.
- `GPT/index.html`: old standalone source page now redirects to the homepage, rather than maintaining a second stale band site. It is still excluded from the clean deployment artifact.

`#show` on the homepage identifies the dated September 19 past-show card. Old `#join-show` fragments lead to the show-updates area. Existing song, watch, follow and QR fragments remain valid.

## Cover credits and factual boundaries

**The Story Of Us is a Taylor Swift song.** The streaming recording linked on the site is released under Jeff Story. Do not call it a Rad Dad original, "our only original," or a song written inside the band. Do not conflate Rad Dad with Jeff's original-music projects.

The design intentionally omits an empty upcoming-shows notice. Previously supplied show facts remain in dated history. Add dates only when confirmed. No new fees, set lengths, reviews, awards, sponsors or venue endorsements are asserted.

## Shared behavior and styling

Both pages load `styles.css` followed by `qr/styles.css`. The homepage additionally loads `raddad.css` for the blue-and-lime design. The explicit client and server artifact allowlists include that stylesheet and the imported public arcade files.

`script.js` is shared by both pages. It handles logo fallback, header measurements, optional Apple Music previews and band sharing. The separate review build shares its own root URL; the normal build uses the canonical band URL. Navigation, booking and streaming destinations work without JavaScript. Media players load after an explicit click. Images and Google Fonts remain external where already configured.

## Arcade source and isolated review build

Run `node scripts/sync-arcade.cjs` to reproduce the pinned import from Turdanoid. For a local source checkout, use `node scripts/sync-arcade.cjs --source ../Turdanoid`. Integration changes belong in that importer or `scripts/arcade/`, rather than generated `play/` files. The importer updates both exact artifact inventories. The private band lab stays excluded.

`npm run build:preview` first verifies the clean client artifact, then creates `preview-dist/` for the existing independent Sites demo, with a review banner, preview sharing, noindex and absolute preview social metadata. The separate `preview-artifact.json` records its exact source identity and file hashes. Verify the copied snapshot with `npm run verify:preview -- --artifact-dir ../RadDadDesignPreview/dist/client --expected-sha YOUR_40_CHARACTER_GIT_SHA`. Do not use the established project ID in `.openai/hosting.json`, attach the live domain, or push main. See [the reproducible preview workflow](docs/raddad-preview.md) and [active polish evidence](docs/raddad-polish.md).

`live-video.js` retains direct YouTube fallback, narrow sandboxing, explicit retry, a ten-second opening deadline, focus return and page-exit cleanup. The same five recorded performance destinations are retained. Existing direct-only cards are not changed to unverified embeds. Offline tests do not prove current third-party playback availability.

All public pages keep a 44px-minimum tap target on phone-width interactive elements (brand link, past-show venue link, tap/NFC redirect links), and external links that open in a new tab say so in their accessible name.

`show-state.js` is a retained legacy controller and is **not loaded by either current public page**. Its unit regression contracts use `tests/fixtures/legacy-show.html`, outside the production artifact. Current browser tests prove that neither a clock change nor a history return can revive the retired event UI.

## Traffic analytics

Analytics are off until a separate Rad Dad [GoatCounter](https://www.goatcounter.com/)
site is set up. To enable it in the regular production package, set the public site
code as the GitHub repository variable `RAD_DAD_GOATCOUNTER_SITE`, or pass that
environment variable to `npm run build:production` for a manual package. Leave
it unset to build with analytics off. The script runs only at
`https://raddadband.com` on the homepage, QR landing page and Arcade.

GoatCounter shows traffic trends, visited pages, referring sites and estimated
visitor countries. Rad Dad also sends fixed button-click counts for Hang Out,
Arcade, music and booking. The engagement events count how many visits reached
30 seconds, two minutes or five minutes of visible time on a page. They exclude
time in hidden tabs and do not represent an average visit length. The site sends
no query strings, URL fragments, full referrer paths, contact details or visitor
identifiers. GoatCounter's [privacy policy](https://www.goatcounter.com/help/privacy)
explains how it handles network addresses. Production origin access logs are
managed separately through the server's existing operator workflow.

## Validation

```bash
npm ci
npm run test:install-browsers
npm test
npm run lint:deploy
npm run build:production
npm run verify:production -- --expected-sha YOUR_40_CHARACTER_GIT_SHA
```

On Windows, use `npm.cmd` and `npx.cmd` when PowerShell blocks the unqualified commands. Local browser tests listen on **4317** unless `RAD_DAD_TEST_PORT` is set. A different process already bound to that port is not skipped: Playwright still runs, and a non–Rad Dad homepage fails before any spec.

```bash
RAD_DAD_TEST_PORT=4317 npm run test:e2e
```

GitHub Actions installs Node 24 and Chromium, runs all tests and shell lint, then builds and verifies the exact production artifact. Browser tests synthesize allowed provider responses and reject unexpected external traffic. See `docs/EVERGREEN_AUDIT.md` for this update's audit and verification boundaries.

## Production deployment boundary

The guarded server deployment remains separate from a GitHub merge. Its existing discovery, reviewer, virtual-host-intent and enablement gates are unchanged. Do not enable them or change Che's server as part of a content update without completing the existing runbook.

The documented legacy public-domain server has not yet been verified as clean-artifact-only. Repository files, historical ZIPs and backups must not be deployed with the clean package. Do not describe the public website as updated until its actual responses are checked.

See [the production runbook](docs/production-deployment.md). GitHub Pages and ChatGPT Sites are independent deployment paths; updating repository source alone is not proof that either has published.

## Future show updates

Keep the band hero and social previews evergreen. Add only confirmed dates under Upcoming shows, with real venues and dates. When a date passes, move it to Past shows and remove its calendar/directions calls to action from active surfaces. Update the QR show status at the same time. Do not restore the hard-coded September controller to today's pages.

The regression tests cover correct credits, metadata, section priority, responsive headers, hash targets, old-route redirects, no-JavaScript access, opt-in player loading, safe sharing, dated archives, the absence of stale promotion, phone tap-target sizing, accessible new-tab link naming and the simplified recording cards. Existing player recovery, Worker routing, private-surface safety and deployment/rollback tests remain in the suite.
