# Rad Dad band website

Rad Dad is a Dallas–Fort Worth **cover band**, playing pop-punk, punk and alternative favorites.
The public site is evergreen as of October 2, 2026. The September 19 show is a dated past-show entry, not the site's identity or an upcoming invitation.

## Current public surfaces

- `/`: band introduction, live covers, covered artists, band members, a Taylor Swift cover recording, upcoming-show placeholder, dated history, and direct booking.
- `/qr/`: music-first landing page with accurate cover credits, the same five live-video destinations, follow links and a path back to the main booking section.
- `/tap/`: permanent printed-QR URL, still redirects to `/qr/`. Never remove or repurpose it.
- `/nfc/`: legacy compatibility alias for `/qr/`; the current physical items use printed QR codes rather than NFC hardware.
- `GPT/index.html`: old standalone source page now redirects to the homepage, rather than maintaining a second stale band site. It is still excluded from the clean deployment artifact.

`#show` on the homepage identifies the dated September 19 past-show card. Old `#join-show` fragments lead to the show-updates area. Existing song, watch, follow and QR fragments remain valid.

## Cover credits and factual boundaries

**The Story Of Us is a Taylor Swift song.** The streaming recording linked on the site is released under Jeff Story. Do not call it a Rad Dad original, "our only original," or a song written inside the band. Do not conflate Rad Dad with Jeff's original-music projects.

No upcoming dates have been provided for this update. The site says **No upcoming dates posted yet**, rather than inventing a booking or claiming the band has none. Previously supplied show facts remain in dated history. No new fees, set lengths, reviews, awards, sponsors or venue endorsements are asserted.

## Shared behavior and styling

Both current pages load `styles.css` followed by **`qr/styles.css`**, which now contains shared evergreen overrides. Keeping that existing supplemental URL avoids changing the exact production artifact inventory or requiring a new server deployment helper for one new CSS filename.

`script.js` is shared by both pages. It handles logo fallback, sticky-header measurements, optional Apple Music previews and sharing a fixed canonical band URL. Navigation, booking and streaming destinations work without JavaScript. Apple Music loads only after an explicit preview click; YouTube inline frames load only after a card click. Images and Google Fonts remain external where already configured; this is not a claim of zero third-party requests.

`live-video.js` retains direct YouTube fallback, narrow sandboxing, explicit retry, a ten-second opening deadline, focus return and page-exit cleanup. The same five recorded performance destinations are retained. Existing direct-only cards are not changed to unverified embeds. Offline tests do not prove current third-party playback availability.

`show-state.js` is a retained legacy controller and is **not loaded by either current public page**. Its unit regression contracts use `tests/fixtures/legacy-show.html`, outside the production artifact. Current browser tests prove that neither a clock change nor a history return can revive the retired event UI.

## Validation

```bash
npm ci
npm run test:install-browsers
npm test
npm run lint:deploy
npm run build:production
npm run verify:production -- --expected-sha YOUR_40_CHARACTER_GIT_SHA
```

On Windows, use `npm.cmd` and `npx.cmd` when PowerShell blocks the unqualified commands. To isolate browser tests from another local project:

```bash
RAD_DAD_TEST_PORT=4273 npm run test:e2e
```

GitHub Actions installs Node 24 and Chromium, runs all tests and shell lint, then builds and verifies the exact production artifact. Browser tests synthesize allowed provider responses and reject unexpected external traffic. See `docs/EVERGREEN_AUDIT.md` for this update's audit and verification boundaries.

## Production deployment boundary

The guarded server deployment remains separate from a GitHub merge. Its existing discovery, reviewer, virtual-host-intent and enablement gates are unchanged. Do not enable them or change Che's server as part of a content update without completing the existing runbook.

The documented legacy public-domain server has not yet been verified as clean-artifact-only. Repository files, historical ZIPs and backups must not be deployed with the clean package. Do not describe the public website as updated until its actual responses are checked.

See [the production runbook](docs/production-deployment.md). GitHub Pages and ChatGPT Sites are independent deployment paths; updating repository source alone is not proof that either has published.

## Future show updates

Keep the band hero and social previews evergreen. Add only confirmed dates under Upcoming shows, with real venues and dates. When a date passes, move it to Past shows and remove its calendar/directions calls to action from active surfaces. Update the QR show status at the same time. Do not restore the hard-coded September controller to today's pages.

The new regression tests cover correct credits, metadata, section priority, responsive headers, hash targets, old-route redirects, no-JavaScript access, opt-in player loading, safe sharing, dated archives and the absence of stale promotion. Existing player recovery, Worker routing, private-surface safety and deployment/rollback tests remain in the suite.
