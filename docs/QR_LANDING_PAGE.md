# Rad Dad QR Landing Page

## Purpose

`https://raddadband.com/qr/` is the destination for the QR code attached to
Rad Dad's physical promotional pieces. Visitors have already scanned the code
before this page opens, so the experience should immediately reward them with
the band's personality, featured song, live performances, show information,
and follow links.

The landing page is not an instruction page. Avoid spending its highest-value
space explaining QR technology or telling visitors to scan something they have
already scanned.

## Current physical workflow

- Print one current Rad Dad cassette, floppy disk, VHS, or collectible.
- Apply one `25.4 mm / 1 inch` round QR sticker to its protected rear or
  underside landing.
- Use matte-white permanent adhesive stock with pure black QR modules.
- Encode the permanent printed-QR URL: `https://raddadband.com/tap/`.
- Preserve the complete white quiet zone around the QR matrix.
- Scan-test every batch before installation and test a sample again after
  installation.

The current production pieces do **not** contain NFC tags. NFC is a retired
experiment and must not be presented as a feature of the current products.

## Artwork source

The production-ready one-inch QR masters and print sheets live in the
[`Rad-Dad-NFC-Tags`](https://github.com/rupret007/Rad-Dad-NFC-Tags) repository
under:

`release/v9/guides/qr_stickers/`

For professional sticker ordering, use the single black-on-white vendor master.
For temporary local production, use the black 48-up FedEx Office sheet or the
63-up Avery/OnlineLabels sheet at exactly `100%` scale.

## Landing-page copy guardrails

- Lead with Rad Dad, the music, and the next useful action.
- Keep the hero's media language playful and music-focused.
- Do not describe the visit as an NFC transmission.
- Do not tell visitors to tap their phone or tap the printed item.
- Do not add redundant QR-scanning instructions to the page hero.
- “Side A / Track 01” and “You found Rad Dad” are intentionally neutral across
  cassette, floppy disk, VHS, and collectible formats.

## Routing

- Permanent printed-QR URL: `https://raddadband.com/tap/`
- Canonical landing-page destination: `/qr/`
- Permanent aliases: `/tap`, `/tap/`, and `/tap/index.html`
- Legacy aliases: `/nfc`, `/nfc/`, and `/nfc/index.html`

The `/tap/` URL is already printed on physical QR codes. Never delete, rename,
or repurpose it. The Worker redirects it to `/qr/` with HTTP 301, and
`tap/index.html` provides a platform-independent fallback for static hosting.
That fallback resolves `../qr/` from the current document URL so it also stays
inside a project-site prefix such as `/RadDadSite/`.

The NFC aliases remain strictly for backward compatibility. They do not
indicate that current products contain NFC hardware. Keep the canonical URL and
Open Graph URL pointed at `/qr/`, while all physical QR codes continue to use
the stable `/tap/` URL. `nfc/index.html` is the matching prefix-safe static-host
fallback for old NFC links.

Keep music, video, show, and follow content only in `qr/index.html`. The `/tap/`
and `/nfc/` files are redirect-only compatibility shims so QR stickers, old NFC
links, and tag links cannot drift into separate landing-page experiences.

## Show lifecycle

`/qr/` and the homepage consume the same `show-state.js` controller. The QR
show panel must present one primary action rather than parallel calendar and
directions buttons: calendar before show day, directions on show day before
7 PM Central, the public running order from 7–10 PM, and the current live-video
section after the show. Its status strip and show copy must come from that same
state.

Keep a real local calendar link in the static HTML as the no-JavaScript
fallback. The controller may progressively replace it only with the configured
directions URL, the review-safe public `#official-sets` anchor, or the local
video anchor. A missing action destination or label hides the action; it must
not manufacture a URL. Never add `/show-control` or copy show-board data into
this static site.

## Live-video playback

Wildflower performance cards that have been manually verified as embeddable
are progressively enhanced on `/qr/`. An unmodified tap or click opens a native
dialog and loads the matching video from the privacy-enhanced
`youtube-nocookie.com` embed host. The iframe has no `src` before that explicit
action and is cleared as soon as the dialog closes, which both avoids a
premature third-party request and stops playback reliably. A card must not gain
`data-inline-video` until its exact public video plays successfully in that
embed. Videos with embedding disabled remain direct links labeled “Watch on
YouTube”; never route them through a knowingly unavailable inline player.
The iframe sends only the site origin on cross-origin requests; YouTube requires
that limited player identity and rejects a fully suppressed referrer.

The cards themselves must remain canonical HTTPS `youtube.com/watch` links
with `target="_blank"` and `rel="noopener noreferrer"`. If the URL is malformed,
the video ID is not exactly 11 safe characters, JavaScript is unavailable, or
the browser lacks `HTMLDialogElement.showModal`, the script does not intercept
the click. That fail-open playback path sends the fan to the original YouTube
page instead of manufacturing or guessing an embed URL.
