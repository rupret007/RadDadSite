# Visit planning — September 5, 2026

## Product behavior

A fan can open **Plan your visit** inside the existing homepage or QR show
panel to read the full address and open directions before show day or while
arriving during the show. Previously, the visible facts stopped at the city;
the QR primary action offered the calendar before show day and the running
order during the show, leaving no map action in those phases.

The disclosure contains only existing event facts: September 19, 2026,
7–10 PM Central (CDT), Guitars & Growlers, 581 W Campbell Rd Suite 101,
Richardson, TX 75080. Its map and venue-information destinations are the
existing links. There are no new booking claims, travel estimates, parking
promises, access policies or band schedules.

The primary calendar → directions → running order → video path and show
sharing remain in place. The disclosure uses native `details`/`summary`,
opens with keyboard or touch, and is usable with JavaScript disabled. The
full address remains selectable if the fan cannot open a map.

At show end, `show-state.js` changes the summary to **Venue details** and hides
directions. The dated address and venue link remain readable. It keeps an
already-open disclosure open; if the expiring directions link had focus,
focus returns to its summary. The existing minute timer still refreshes state,
and `pageshow`/`visibilitychange` now refresh the whole show journey immediately
on return. Stopping the controller removes both listeners and the timer.

## Privacy and scope

Opening the disclosure makes no map or venue request, reads no location,
writes no clipboard or local storage, and sends no event or booking message.
Links navigate only after the fan activates them and open with
`noopener noreferrer`. The map URL is the existing fixed destination; there
is no visitor-location query or embedded map. The complete public address is
already present in the calendar, structured event metadata and sharing facts.

This slice changes only existing public HTML/CSS/controller files, tests and
documentation. The worker, production allowlist, dependencies, workflows,
approved flyer assets, video IDs, `/tap/` and `/nfc/` are unchanged. Travis
continues to own booking; never auto-pitch or post.

## Verification

`tests/unit/show-visit.test.js` and `tests/e2e/show-visit.spec.js` cover the
address/time parity, phase behavior, return from another page/tab, controller
cleanup, keyboard/native disclosure, mobile layout and no-JavaScript path.
Browser checks reuse the existing offline network fixture. Map/provider
requests are not used as validation and no real directions or phone handoff
is claimed.

Run the full unit, deployment-harness and offline Chromium suites, ShellCheck,
then both clean-commit package builds and production verification as described
in the README. Exact-tip hosted execution and final counts belong in the draft
PR and coordination AFTER; this source document does not predict a hosted pass.

## Remaining limits and future changes

The clock is the visitor's device clock. With JavaScript disabled, the dated
static disclosure works but does not automatically change into archive state;
this matches the existing static event fallback. Real device mapping-app
selection, provider availability and venue policies remain outside the offline
test evidence.

For a future approved event, update both disclosures alongside the existing
calendar, event metadata, sharing facts and lifecycle boundaries; run parity
and browser tests before any approved publication. Do not infer another show
from the completed event or copy Show Night's official lists into this site.

This is source and review work. An OPEN DRAFT and successful tests authorize no
merge, release, deployment, Pages change, server cutover or live data action.
Che/Jeff retain the deployment decision under the existing runbook.
