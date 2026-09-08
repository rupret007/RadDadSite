# Handmade band-wall polish

Base: `dd5a8e638d58353ec9c45d584c60c67ef69f6f1b`.

The covers wall already had per-band classes and decorative scraps, but its
similar tile heights, small rotations, and muted backings read as an orderly
grid. This slice edits those existing rules in `styles.css`:

- Saturated cut-paper backings, oval stickers, crooked textured tape, and
  darker underlines distinguish the clippings.
- Green Day uses the already-loaded Permanent Marker face; Jimmy Eat World
  uses a typewriter face. Larger Green Day, NOFX, and Nirvana lettering adds
  hierarchy, with stronger desktop rotations and small paper-edge overlaps.
- Phones cap rotation at three degrees, stagger the wider scraps, and pair
  smaller bands without empty half-rows. Band order stays unchanged.
- The narrowest Green Day label and fallback-font Pennywise label have room
  to stay readable instead of clipping or covering a neighboring name.

The 14-band semantic list, wording, links, section structure, and all JavaScript
are unchanged. No new font request, asset, dependency, motion, or interaction.
Band names remain plain text, not links or a promised show lineup. Band-lab
remains unlisted; its files and public navigation are unchanged.

Validation: the existing local suite passed 166 unit tests, 85 deployment-helper
fixture checks, and 78 Chromium browser tests. Deployment shell lint and Sites
packaging passed. Homepage checks were repeated after final typography changes.
Additional Chromium inspection used widths 320, 390, 700, 768, 1080, 1440, and
2048 with the existing web fonts loaded and with font fallback; character-center
hit checks caught and resolved the fallback Pennywise collision. Desktop and
phone screenshots were reviewed. These checks are not physical-device testing
or a complete accessibility audit; other browser engines remain unverified.

PRE_KAREN: one OPEN DRAFT for Karen leftover + security review. Hosted results
and the exact unsigned tip are recorded in the PR and Bob-the-Bot coord #8.
No merge, Pages, deployment, signing, release, sending, or spending.

Markers: `BOB_NEW_SESSION_FREELANE_20260907_2307` /
`OVERNIGHT_FREELANE_RADDAD_20260907_2307`.
