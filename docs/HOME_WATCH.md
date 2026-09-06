# Homepage cover tapes — September 6, 2026

## Product behavior

A fan who just saw the homepage covers wall can open **Hear the Wildflower
tapes** and watch the existing recordings without leaving the page when
YouTube allows embedding.

The flyer artist wall stays unlinkable and still names bands, not songs. The
new path lives in the existing covers footer beside Hear Rad Dad, Help shape
the night, and the September 19 show link. It uses the existing `#live-tapes`
anchor. No song titles were added to `#covers`.

The three Wildflower uploads already verified as embeddable on `/qr/` —
All the Small Things, She, and The Middle — now use the same shared
`live-video.js` player on the homepage. An unmodified tap opens a native
dialog and loads `youtube-nocookie.com` only after that gesture. Closing the
dialog clears the frame and returns focus to the card.

Tomorrow’s Another Day and Linoleum remain clearly labeled direct YouTube
links. Every card stays a real `youtube.com/watch` link, so modified clicks,
missing `HTMLDialogElement.showModal`, and no-JavaScript visits keep the
direct fallback.

## Privacy and scope

The player iframe has no `src` until the fan taps a verified card. It sends
only the site origin on cross-origin requests because YouTube requires that
limited player identity. Opening the covers footer or a video card writes no
clipboard or local storage and sends no booking or social message. Travis
continues to own booking; never auto-pitch or post.

This slice changes existing public HTML/CSS, the shared player, tests,
allowlists, and documentation. Flyer artwork, band billing, video IDs,
`/tap/`, `/nfc/`, the Worker, packages, and lockfile are unchanged.

## Verification

`tests/unit/live-video.test.js` covers homepage and QR play, close/focus
return, invalid receipts, and homepage direct-only cards.
`tests/e2e/homepage.spec.js` covers the covers-footer path, 390 px inline
play/close, and overflow while the dialog is open. QR’s existing inline
journey still uses the shared script.

Run the full unit, deployment-harness and offline Chromium suites,
ShellCheck, then both clean-commit package builds and production
verification as described in the README. Exact-tip hosted execution and
final counts belong in the draft PR and coordination AFTER; this source
document does not predict a hosted pass.

## Remaining limits and future changes

Device clocks, real YouTube playback, and provider embed policy remain
outside the offline test evidence. A card must not gain `data-inline-video`
until its exact public video plays in the privacy-enhanced embed. Do not
infer official-set membership from a Wildflower tape or turn the flyer wall
into artist links.

This is source and review work. An OPEN DRAFT and successful tests authorize
no merge, release, deployment, Pages change, server cutover or live data
action. Che/Jeff retain the deployment decision under the existing runbook.
