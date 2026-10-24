# Rad Dad design preview — October 24, 2026

User scope: bring Stalemate's punk flyer design, homework invitation, and arcade to Rad Dad, preserving Rad Dad's colors, existing videos, cover credits, and contacts. Do not call out a lack of upcoming shows. Keep main and raddadband.com untouched. Deliver a separate link for Travis.

Checkout: `/Users/jeffstory/Documents/ChatGPT/Stalemate Website/RadDadSite`.
Branch: `codex/raddad-arcade-preview`, based on main `704ec6b95878cf071ad1fe0d857f9a0ee3070974`.
Existing `.openai/hosting.json` identifies the established site and must not be used to publish this preview. Vercel preview workflow selected instead; only the verified static artifact will be uploaded.

Arcade source: Turdanoid main `01e72b614189894c41994d2a54a94433977fc9b3`. Repeatable importer: `node scripts/sync-arcade.cjs [--source local-checkout] [ref]`. Rad Dad adaptation retains game sound effects and APIs, removes Stalemate recordings/music controls, rebrands result cards, and includes no private band-lab code. Seven games; no daily challenge, accounts, multiplayer, or invented activity.

Implemented: blue/lime punk flyer homepage with the existing The Middle video featured; “Do your homework” retains all five clips and their original destinations; arcade with three game previews and all seven playable games; preserved members, recording credits, booking and route aliases; show history without empty upcoming messaging. Preview build labels the review, sets noindex and shares its own origin. The established Sites config, private band lab and live host are untouched.

Validation on Node 24.22.1: 232 unit checks, 4 documentation checks, and 144 browser checks pass; shell lint passes. Browser checks use pinned Chromium headless shell 1208, including 390px/1280px game starts, 320px homepage layout, video recovery, no-JS routes, QR aliases, result branding and storage-denied public arcade. Earlier attempts caught and fixed a 320px card overflow and a test worker-proxy teardown race; failed runs are retained separately. An initial unsupported browser run also showed legacy private-hub timing sensitivity; the final pinned-browser suite passed without changing private code.

Importer reproduced byte-for-byte across 155 files (153 public files plus client inventory/server helper). Exact artifact verification passed. The server helper still enforces explicit paths, now including the public arcade, and production deployment gates remain unchanged. Full shell deployment regression result will be recorded in the external handoff after completion.

Evidence lives in `../release-evidence/raddad-preview/`, outside the deployable site. Desktop and phone rendered screenshots have been inspected; final preview screenshots and publication URL follow the final source commit. External media is stubbed in automated browser tests, so those checks do not establish provider playback availability or physical-phone acceptance.

Next: commit this feature branch, build the exact committed source, check the isolated preview locally, deploy only `preview-dist/` via the Vercel preview workflow, and record the returned preview URL in `../RADDAD-PREVIEW-HANDOFF.md`. Never push main or merge this branch.
