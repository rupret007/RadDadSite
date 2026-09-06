# Public broken-link recovery — September 6, 2026

## Product change

An old nested page link such as `/past-show/details/` previously fetched the
homepage internally but kept that missing address in the browser. Relative
styles, scripts, images, flyer links and calendar downloads then resolved under
the wrong directory. The previous unit test used a one-segment missing path,
which concealed that failure.

The existing Sites Worker now returns a temporary **302** to the same request
origin's `/` with an explicitly empty fragment. This gives the existing
homepage its correct resource base; it is not a new page, alias, navigation
redesign, or copied setlist. Phone and no-JavaScript visitors use the same
recovery path.

Recovery is limited to missing ordinary public page paths (extensionless or
`.html`) requested with GET and an accepted positive-quality `text/html` range.
Existing asset responses, other methods, non-HTML requests, missing resource
files, reserved paths and missing canonical pages retain their actual status.
The root never redirects to itself when missing. Existing QR/tap/NFC redirects
and owner-route blocking are unchanged.

## Privacy and boundaries

The recovery destination contains no stale path, query or inherited fragment.
`Cache-Control: no-store` avoids saving this as a permanent alias, and
`Referrer-Policy: no-referrer` suppresses the redirect-hop referrer. These
controls do not erase the original URL from browser history or server logs.
Known QR aliases intentionally retain their existing query behavior.

No client HTML, visual styling, flyer assets, show facts, song IDs, booking
actions, send paths, dependencies or deployment workflow changed. Travis books;
never auto-pitch or post. Owner controls do not become a public recovery target.

This changes **Worker-backed Sites hosting** only. The separate legacy Apache
server and other static hosts are not covered by this routing implementation.
Building a package is not deployment. Jeff/Che retain all Pages and server
cutover decisions.

## Verification and handoff

- Before implementation, the actual worker returned200 with no redirect for a
  synthetic nested URL; its stylesheet resolved to a nonexistent nested path.
- `tests/unit/worker-recovery.test.js` covers recovery destination/status,
  privacy headers, positive HTML negotiation, loop prevention, error/method/
  resource boundaries and existing owner holds.
- `tests/e2e/worker-recovery.spec.js` imports the real worker and uses a strictly
  same-origin synthetic ASSETS adapter. It exercises Chromium at phone widths,
  stylesheet and show-state loading, flyer links, actual local calendar download
  bytes, no-JavaScript recovery, QR aliases, owner errors and non-GET behavior.
- Existing unit, synthetic deployment-helper and browser suites remain required;
  clean-commit Sites and production packages must build and verify. Exact
  counts, frozen tip, hosted results and limitations belong in the draft PR.

The first isolated Mac browser run canceled both direct and recovered calendar
downloads. The unchanged tests passed after setting `MAC_CHROMIUM_TMPDIR` to
the existing permitted task scratch, alongside `TMPDIR`; no filesystem or
network permissions were widened. Chromium's [macOS temporary-directory
implementation](https://chromium.googlesource.com/chromium/src/+/0b85fca82f6d5506a9cc9cfcaa1d746aa9b4ef66/base/files/file_util_mac.mm)
explains that separate override. Retain the real download-completion and byte
assertions; do not replace them with a URL-only check. Local Node22.22.3 and
hosted Node24 are separate execution environments, not an exact-version claim.

Offline provider fixtures do not verify real Apple Music/YouTube playback,
live hosting, authentication or production cutover. This slice must remain an
OPEN DRAFT for Karen's leftover/security review; authoring it grants no merge,
tag, signing, deployment, Pages, messaging or spending authority.
