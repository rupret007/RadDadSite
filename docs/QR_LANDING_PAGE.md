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
