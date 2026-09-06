# Useful next action — September 6, 2026

## Product behavior

The printed-QR status strip and the listen desks now follow the same useful
action the show panels already use.

On `/qr/`, the sticky strip still jumps to the show panel before the show and
on show day before 7 PM Central. From 7–10 PM it uses the existing public
`#official-sets` running-order link. After 10 PM it lands on `#wildflower`.
The CTA label matches that destination. On a phone the words stay in the
accessible name and only the arrow is drawn, so a longer live or after-show
label cannot crowd the venue. The strip does not receive an `aria-label`, so
the visible status, date, venue, and CTA stay in the accessible name. A
missing phase destination leaves the static `#next-show` fallback in place
instead of hiding the strip.

The homepage watch heading stays **Hear Rad Dad before the show** until the
show ends. After 10 PM it matches the primary action: **Watch Rad Dad live**,
with lede copy that the Wildflower tapes and The Story Of Us remain on the
page. The complete primary action still goes to `#watch`.

Both listen desks now include the existing tapes path the watch lede already
promised: homepage **Hear the Wildflower tapes** → `#live-tapes`, QR song
paths → `#wildflower`. No new recordings, facts, or player behavior.

An unmodified activation of an in-page primary or strip action moves focus to
that landing so keyboard users are not left on the control they just used.

## Privacy and scope

Live strip activations use only the review-safe public board URL already used
by the show panel, with `noopener noreferrer`. The strip never points at
`/show-control`. Opening the strip or a listen-desk tapes link writes no
clipboard or storage and sends no booking or social message. Travis continues
to own booking; never auto-pitch or post.

This slice changes existing public HTML, `show-state.js`, tests, and
documentation. Flyer artwork, band billing, video IDs, `/tap/`, `/nfc/`, the
Worker, packages, and lockfile are unchanged. It does not redo visit planning,
covers-wall tape discovery, or inline-player recovery.

## Verification

`tests/unit/show-state.test.js` covers strip href/label/target by phase, the
misconfigured-strip fallback, complete watch copy, and in-page focus.
`tests/e2e/show-lifecycle.spec.js` covers both surfaces, the QR strip through
all four phases, after-show tape landing, and the no-JavaScript strip
fallback. Homepage and QR browser specs cover the new listen-desk tapes paths.

Run the full unit, deployment-harness and offline Chromium suites,
ShellCheck, then both clean-commit package builds and production
verification as described in the README. Exact-tip hosted execution and
final counts belong in the draft PR and coordination AFTER; this source
document does not predict a hosted pass.

## Remaining limits and future changes

Device clocks decide the phase. Without JavaScript the QR strip stays on the
show panel. Real board/provider availability and real YouTube playback remain
outside the offline test evidence. Do not infer a next booking from the
completed show or copy official-set records into this site.

This is source and review work. An OPEN DRAFT and successful tests authorize
no merge, release, deployment, Pages change, server cutover or live data
action. Che/Jeff retain the deployment decision under the existing runbook.
