# Show sharing — September 5, 2026 product handoff

## What changed

Fans can share one complete show note from the existing homepage or QR show
panel. The compact secondary control preserves the primary show lifecycle
action and reuses `show-state.js`; no new page, store, dependency, or service.

`RadDadShowState.shareDetails(now)` returns frozen phase/title/text/url/copyText
fields. Both surfaces use the same named bands, date, Central time, venue,
address, free cover, and fixed `https://raddadband.com/#show` link. Tests compare
the facts against the existing calendar and event metadata. Do not use preview
URLs, query parameters, private fragments, arbitrary DOM copy, or invented
future bookings to construct this note.

## Happy path and recovery

- A user gesture opens native share options if available; otherwise the action
  is labeled Copy show details. There is no API call on load.
- Only native title/text/url fields are passed to the OS. A resolved share
  says the options closed, not that a recipient received a message.
- Cancelled or unavailable sharing offers a visible full note and explicit
  Copy details / Select details choices. It never automatically copies.
- Clipboard rejection or absence selects the readable note for manual copying.
  Permission errors are not shown as successful copies; no permission settings
  are changed and no legacy hidden-copy workaround is used.
- Pending actions are single-flight. Wording is rebuilt on each gesture and
  refreshed on page return. A completion across a phase boundary offers the
  current note with a warning; an OS action already started cannot be revoked.
- Without JavaScript, a normal canonical public show link remains available.

The browser API's `AbortError` can mean cancellation **or** no available share
targets, and promise fulfillment is not recipient-delivery proof. See the
[Web Share specification](https://www.w3.org/TR/web-share/). Clipboard writes
can be rejected by browser permissions; see the
[Clipboard specification](https://w3c.github.io/clipboard-apis/#dom-clipboard-writetext).

## Verification

Run from a clean checkout with the lockfile's supported Node version:

```sh
npm ci
npm run test:unit
npm run test:deploy
CI=1 RAD_DAD_TEST_PORT=51314 npm run test:e2e -- --workers=1 --retries=0
npm run lint:deploy
npm run build:sites
npm run build:production
npm run verify:production -- --expected-sha YOUR_40_CHARACTER_GIT_SHA
```

ShellCheck is required for `lint:deploy`; shell syntax checks are not an
equivalent substitute. Build from the final clean commit so artifact identity
matches the source being reviewed. Building the second package replaces the
first local `dist` output; neither build deploys it.

`tests/unit/show-share.test.js` exercises canonical facts, phase boundaries,
single-flight behavior, teardown, and native/clipboard failure paths.
`tests/e2e/show-share.spec.js` covers both actual pages, 320/390 px recovery,
focus, transient activation, no-JavaScript access, and a late clipboard result.
The shared browser fixture allows the local server only, stubs known external
media/font responses, and fails unexpected external requests. These are
controlled offline browser tests, not real OS/device/provider acceptance.

## What is still owner-only

On an explicitly approved preview/device, Jeff can check the actual OS share
sheet and clipboard behavior on his preferred phone/browser. Nothing here
claims real delivery or modifies recipients, accounts, or permission settings.
No live messages or posts were sent by the implementation tests.

This is source and package work only. The production cutover remains owned by
Che/Jeff under [the deployment runbook](production-deployment.md). No server,
DNS, Pages, credentials, or live content is changed by this draft. Existing
flyer/artwork, band billing, video IDs, `/tap/`, and legacy `/nfc/` routes remain
unchanged. Travis continues to own booking and connections; no auto-pitch.

For a future show, update the existing event facts and lifecycle boundaries
together, then run parity tests before publishing. Do not infer a next booking
from a completed show, add a second event store, or interpret a successful
native handoff as proof that someone received an invitation.
