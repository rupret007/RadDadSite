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
- Encode only the canonical HTTPS URL: `https://raddadband.com/qr/`.
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

- Canonical destination: `/qr/`
- QR payload: `https://raddadband.com/qr/`
- Legacy aliases: `/tap`, `/tap/`, `/nfc`, and `/nfc/`

The worker retains the NFC aliases strictly for backward compatibility. They do
not indicate that current products contain NFC hardware. Keep the canonical URL,
Open Graph URL, and all newly generated QR codes pointed at `/qr/`.
