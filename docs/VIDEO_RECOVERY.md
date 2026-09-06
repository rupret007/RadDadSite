# Inline-video recovery

Base: `2df3e4e9aba9f52e2b137f2bcc726d0870b3d502`, after #32.

## Product change

Homepage and QR fans can recover a blocked or stalled inline recording without
closing the dialog and finding the card again. The existing shared player now
shows an accessible status, **Try again**, and the selected tape's existing
**Watch on YouTube** exit. This extends #32's inline player; it does not redo
its cover-tapes discovery path or change the five recordings.

- An explicit card tap opens a fresh privacy-enhanced iframe. No player source
  is loaded before that gesture. Retry is disabled during the opening attempt.
- After ten seconds without a frame response, or a frame error, the pending
  source is removed so late navigation cannot start autoplay unexpectedly.
  The fan may try again or take the exact YouTube link. Nothing retries itself.
- A frame load only changes the instructions to use the player's controls.
  It never proves that a video is playable: cross-origin error pages also load.
  Retry and YouTube remain available even after that event.
- Each explicit retry uses a different iframe with the same selected video and
  privacy attributes. Old listeners/timers are retired. Late old events cannot
  clear a newer attempt, change the selected title, or reopen a closed dialog.
- Close, Escape, and backdrop dismissal clear playback and return focus to the
  tapped card. A plain activation of Watch on YouTube clears playback before
  leaving, without preventing the link's native target/destination. Modified
  clicks preserve their existing behavior.
- The dialog's single grid column can shrink below its contents' intrinsic
  width, so the title, recovery text and YouTube exit stay inside a small phone.
  The frame height is viewport-bounded so a wide desktop player leaves room
  for the recovery actions instead of pushing the exit below the visible area.

## Boundaries

No iframe API messages, new provider API, storage, dependency, recording ID,
show fact, band bill, flyer artwork, or booking flow is introduced. Unsupported
dialogs and no-JavaScript visits retain real YouTube links. The featured MxPx
video and Linoleum remain direct-only. No Worker or permanent tap/NFC redirect
changes are part of this work.

The timeout bounds an opening attempt, not the duration of a performance or
the time before a fan presses Play. A frame that loads but cannot play still
requires the fan's explicit Retry or YouTube choice. The site does not inspect
cross-origin player contents or claim provider acceptance. Autoplay within a
selected frame remains subject to the browser's own rules.

## Verification map

- `tests/unit/live-video.test.js`: both-page state transitions, exact selected
  URLs, ten-second deadline, disabled pending retry, fresh frames, stale
  load/error/timer/close events, fallback cleanup and native modifier behavior.
- `tests/e2e/video-recovery.spec.js`: real-browser stalled request and retry,
  loaded-but-unplayable synthetic document, explicit handoff cleanup, error
  recovery, keyboard retry/handoff, Escape/focus, 320/390/1280px layouts and
  no-JavaScript card fallbacks.
- Existing full unit, deploy-safety fixture and browser suites must remain
  green. ShellCheck and clean-commit Sites/production artifact build/verification
  remain required. Executed counts and exact-tip hosted receipts belong in the
  PR and coordination AFTER; this document does not predict a pass.

All media responses and failure scenarios in these tests are controlled
offline fixtures. Real YouTube playback, browser autoplay policy, device feel
and accessibility with a real embedded player remain manual checks for an
approved rollout. No real provider or outbound communication is exercised.

## Handoff

Review the exact draft tip for Karen leftover + security. Che/Jeff retain any
Pages, server or Sites deployment decision. A tested source artifact does not
mean the live site changed. Travis books; never auto-pitch or post. No merge,
tag, signing, release, deploy, live customer/provider action or spending is
authorized by this document.

Made-with: Codex Astra Ultra
