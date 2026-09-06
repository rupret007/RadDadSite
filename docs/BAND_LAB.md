# Unlisted band lab — September 6, 2026 leftover polish

## Product behavior

The band-mates desk at `/private/garage-rehearsal-k7m2n9/` stays an unlisted
rehearsal page. It is Pages-ready as a repo path and is **not** linked from the
homepage, primary nav, footer, `/qr/`, `/tap/`, or `/nfc/`.

This leftover slice keeps the playable Turdanoid six-game hub and the honest
WebJam-shaped hole from [#36](https://github.com/rupret007/RadDadSite/pull/36),
then polishes the desk so a band mate has a reason to return on the same
device:

- the same punk-flyer wheatpaste treatment as the public covers wall;
- a six-game sewer roster that names the hub games without inventing extra
  doors;
- an honest return note: Continue / last-played lives on **this phone**,
  arcade mid-run saves stay parked with Turdanoid PR #8, and the URL is not a
  lock;
- a same-folder **Open the sewer full-page** link for phone play;
- a cardboard WebJam slot that still loads nothing and still pretends to
  stream nothing;
- on-page PRE_KAREN leftovers instead of a share/auto-post widget.

No JavaScript was added to the desk page. Native `details` is enough.

## Exact URL to share (Jeff / Che only)

After an owner publishes this path on the GitHub Pages host (this draft does
**not** publish Pages):

- Project Pages: `https://rupret007.github.io/RadDadSite/private/garage-rehearsal-k7m2n9/`
- If the Pages custom domain is already the site root: `https://raddadband.com/private/garage-rehearsal-k7m2n9/`

Local preview: open `/private/garage-rehearsal-k7m2n9/` on the repo static
server.

Text or DM the URL. Do not put it on Instagram, the merch table, a sticker, a
sitemap, or the public site. Anyone with the URL can open it.

## PRE_KAREN leftover + security notes

Karen review later. Leftovers and honesty:

- **Obscurity is not access control.** `noindex, nofollow, noarchive` plus an
  unguessable path plus no public links reduce casual discovery. They do not
  authenticate band mates. The HTML is in a public GitHub repo, so the path is
  visible to anyone who reads the tree, this PR, or CI logs.
- **Do not treat this as private data storage.** No secrets belong here. Game
  `localStorage` stays in the visitor’s browser.
- **Iframe sandbox** remains `allow-scripts allow-same-origin` so the vendored
  hub can run and keep continue-state. That is the same class of trust as
  hosting the game files. No `allow-popups` / top navigation.
- **Production vs Pages.** Che’s clean-artifact server path will not serve this
  page until someone adds it to `CLIENT_SOURCE_PATHS` on purpose. This slice
  does **not** add `/private/` to that allowlist. Worker-backed Sites without
  the files still 404 `/private/...` instead of sending fans to a fake
  homepage.
- **SEO leftover.** There is still no root `robots.txt` disallow (that would
  advertise the path). Page-level `noindex` only.
- **Turdanoid leftover.** Arcade mid-run saves remain parked with Turdanoid
  PR #8. Neon physics were not rewritten. The vendored snapshot stays pinned
  to Turdanoid main tip `600b96caa3064368f44cc8b79eb8c97950211fee`. Turdanoid
  main later moved to `2b1864fa118962abf98c5cf34acdbf58f4f1d699` (Crapjack
  Smart #24, hub unchanged). This desk did not silently re-pin. A later slice
  may update the pin only with honest blob-match tests.
- **Share leftover.** No copy/share widget on the lab page. Jeff still pastes
  the URL by hand.
- **Future WebJam.** Wire a real attractor only when it exists. Do not turn
  the cardboard slot into a fake live embed.

## What was intentionally not changed

- Public HTML/CSS/nav/footer/homepage/QR/tap/NFC
- Production artifact allowlist (`dist/client` still ships only the public site)
- Vendored Turdanoid game blobs / Neon physics
- Turdanoid repo and parked PR #8
- No secrets, spend, auto-post, merge, tag, or Pages publish

## Verification

`tests/unit/band-lab.test.js` covers noindex, no public doors, the honest
WebJam hole, the six-game roster, PRE_KAREN leftover copy, Git blob-match
against the documented Turdanoid pin, and the clean public allowlist.
`tests/e2e/band-lab.spec.js` plays TurdAnoid from the hub, opens the same-folder
full-page sewer, checks phone layout, and proves homepage / QR / tap / NFC
do not link here.

Run the full unit, deployment-harness and offline Chromium suites,
ShellCheck, then both clean-commit package builds and production
verification as described in the README. Exact-tip hosted execution and
final counts belong in the draft PR; this source document does not predict
a hosted pass.

This is source and review work. An OPEN DRAFT and successful tests authorize
no merge, release, deployment, Pages change, server cutover or live data
action. Che/Jeff retain the deployment decision under the existing runbook.
