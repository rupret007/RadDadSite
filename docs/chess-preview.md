# Royal Flush Chess — release candidate

Reusable source: Turdanoid `cf9a1388278e645a76a192de4b0c2ece2edb4169`, draft PR [103](https://github.com/rupret007/Turdanoid/pull/103), stacked on PR 102. Receiving branch: `codex/chess-preview`, draft PR [66](https://github.com/rupret007/RadDadSite/pull/66), stacked on PR 65. Preserve the existing PRs/status and all unrelated work. Exact final site/hosting versions and CI/deployment receipts are recorded in the workspace CHESS-PREVIEW-HANDOFF.md and release-evidence/chess/. Publication is gated by final exact-head CI and anonymous verification; the handoff and PR record the final status.

## Final behavior

Chess is the eighth arcade game: computer practice with four real bounded difficulty settings, local two-player, hints/takebacks, legal moves/draw claims, promotion, review/history, board flip, restart/rematch/resign and PGN export. New visitors start with Friendly. Independent validated device-local saves/results preserve the original game keys; only an unfinished valid game receives Continue. Finished games stay reviewable/exportable after refresh.

Original vector pieces, readable notation/controls, selection/legal/check/last-move cues, reduced-motion-aware transitions and high contrast fit the blue/lime arcade. Square cells preserve geometry at 320px; explicit 568×320/667×375/844×390 layouts keep the entire board visible. Primary controls remain 44px; dense board cells stay at least 24px. Coordinates and move markers meet text/UI contrast thresholds in both palettes. Play/help stay disabled until their handlers bind; shared loading recovery handles failed/stalled modules.

One single-threaded Stockfish worker stays warm after a completed search. Undo, restart/mode changes, review/help, visibility/navigation and game completion terminate active/idle work. Requests have bounded searches, hard timeouts and stale-generation/position checks. Failure offers deliberate retry or local play. Rad Dad imports no Stalemate recordings; effects/global mute remain consistent. Homework, five videos, contacts, colors and original games/content stay intact.

## Reuse and source obligations

[chess.js 1.4.0](https://jhlywa.github.io/chess.js/) (BSD-2-Clause) supplies legality/notation; [Stockfish.js 19.0.1](https://github.com/nmrugg/stockfish.js/tree/v19.0.1) (GPLv3), unmodified lite single-threaded build, supplies computer play. Licenses, exact corresponding engine source/build scripts, embedded lite network and build instructions ship beside the binaries. Public version/hash manifest and readable new GPL chess modules are linked from the game. No compiler rebuild or calibrated Elo claim is made. Research, recent player anecdotes and design rationale are in the pinned upstream docs/chess-development.md; anecdotes are not representative popularity/retention evidence.

The sole permitted/tracked public archive is `play/assets/chess/stockfish-19.0.1-source.tar.gz`. It is explicitly inventoried and checksum-verified. A clean-clone regression requires every public source path be tracked. All unrelated archives, private/development directories and credentials remain forbidden. The importer handles nested license-page CSP/noindex, cover extraction, exact inventory and source revision; regenerate rather than editing play/ alone.

## Evidence and limits

Full local site checkpoint: 4 docs, 236 final unit, 109 deployment fixture checks and 175 browser tests passed. Final pinned arcade/chess rerun 28/28 passed before the last typography/contrast/startup refinements; two added short-landscape cases bring the current suite to 177. Final exact-head CI must qualify the final candidate.

Upstream full checkpoint had 2016 passing checks plus an older Crapjack startup assertion that incorrectly rejected immediate naturals; the corrected assertion strictly verifies two dealt cards and an active round or a real 21 natural. Focused startup/chess 30/30, final native chess 17/17, required 104 mobile cases and complete smoke passed locally. The older smoke runner was updated from seven to exactly eight games, including native chess start/engine/hint/undo/Continue. First CI failures and failed local runs are retained.

Integrated three-engine review covers native moves, real engine replies/hints/undo/refresh/Continue/mute and PGN contents. The final expanded matrix covers 21 viewport games; actual final run/receipts are in workspace evidence. Earlier native computer acceptance reached White checkmate versus Friendly in 55 half-moves and a natural loss versus Sharp in 4. Winning-player choices were engine assisted; inputs were actual board clicks, with no state/outcome assignment.

Axe reported no violations in two screens, with contrast requiring manual review; rendered color checks cover the corrected board markers/coordinates. Local desktop headless performance measured one WASM request/one worker across ordinary turns. Enlarged-text stress and accessible square-name snapshots were inspected. These checks do not establish physical-phone, screen-reader, speaker-quality or browser-toolbar-zoom acceptance. Exhaustive recognition of every blocked dead position is not claimed.

## CI-discovered private compatibility fix

Older CI twice exposed uncaught denied-storage errors after keyboard navigation to the private legacy hub. Three local reproductions confirmed it. The minimal suite-facade guard is a documented reversible integration patch, not a silent repin: original blob 188fb567898770eaa0f267e656c007f457c0c71d, patched blob 464ee37312db0d243323d09ce849ef73a4680c6a. Unit tests reverse to the exact original and reapply; all other pinned blobs stay unchanged. The browser test waits for full destination load and checks the empty Continue list before asserting no errors. Seven baseline/patch unit tests and native denied-storage keyboard regression pass. The private lab stays excluded from public artifacts.

## Publication boundary

Only update the existing independent public demo, https://rad-dad-design-preview.jeffstory007.chatgpt.site/, after gates pass. Rebuild/verify/copy from the exact final committed site SHA; save/deploy an archive from the exact pushed independent hosting commit. Reuse its project/config/audience. Never push/merge RadDadSite main, deploy established Rad Dad/Stalemate, change domains/hosting/DNS/production gates, or message/invite anyone. Before marking complete, verify the actual hosted source bytes (allowing only the documented host HTML insertion), clean URLs, chess/old-game flows, worker/CSP, exports/continue/recovery/mute, QR aliases and private 404s.
