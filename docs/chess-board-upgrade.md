# Rad Dad replacement chessboard

The actual playing board now uses Chessground10.5.0 with configured Spatial artwork by Maurizio Monge. This is a receiving integration of Turdanoid 10a0e6e201946247ddf4a7ca06f3786a93e69805, source draft PR105, stacked on ready PR104. New site work is stacked on ready PR67. Preserve all parent PR heads/states and main.

The source comparison/acceptance record is docs/chess-board-upgrade.md in Turdanoid. Native drag/tap input, professional ivory/navy pieces, a readable slate/sage board, move/capture/check cues and short animations use the mature library. Existing keyboard square buttons continue to control the same chess.js state. Stockfish, all difficulty choices, saves/mute, one/two-player setup, promotion/cancel, special moves, hints/undo/review/PGN and the other seven games remain.

Chessground GPL source/library: b4f605018e1043640c917e82a74b214cb58e4a05. Spatial MIT art: d8705d8bc9879fef44208de19e2a20c937409e1f. Code/art licenses and hashes are separate in play/assets/chess/board-vendor-lock.json and credits.html. The corresponding-source archive contains matching TypeScript, original art and reproducible build material; its library and12configured SVGs rebuilt byte-identically. Public packaging adds exactly that named GPL archive exception while retaining the rejection of unrelated archives. Workflow and production approval gates are unchanged.

The exact-SHA importer generated190explicit public arcade files. Do not edit play/ alone. Homepage content, homework, videos, contacts, branding and records remain unchanged. Only the existing independent public preview may be published after final exact-head CI and anonymous verification. No established Rad Dad/Stalemate deployment, main push/merge, config/audience/domain/DNS/gate change or external messages.

Qualification receipts, before/after screenshots, initial failed runs, final source/site/CIs and hosted checks belong in the workspace RADDAD-CHESS-BOARD-HANDOFF.md and release-evidence/chess-board/. Physical phones, real screen readers and human beginner acceptance are separate from automated/emulated checks.
