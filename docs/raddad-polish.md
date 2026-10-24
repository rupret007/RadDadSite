# Rad Dad preview polish

October 24, 2026. Source branch: `codex/raddad-arcade-preview`; draft PR [#65](https://github.com/rupret007/RadDadSite/pull/65). The adopted goal is in the parent workspace's `RADDAD-POLISH-GOAL.txt`. Detailed logs, scripts, JSON and rendered evidence are in `../release-evidence/raddad-polish/`.

## Release boundary

Keep the blue/lime design, homework invitation, five original clips and accurate cover credits, booking details, seven games, records/saves, historical dates and printed/legacy QR routes. No empty upcoming-shows notice, invented activity, Daily Dump, multiplayer or accounts.

The review URL remains https://rad-dad-design-preview.jeffstory007.chatgpt.site/ on the independent project `appgprj_6adc6437250c81919a5aee09cb9d91a5`. Its separate checkout is `../RadDadDesignPreview/`. RadDadSite main remains `704ec6b95878cf071ad1fe0d857f9a0ee3070974`. Never deploy the established source hosting config, merge this PR, change raddadband.com/DNS or create a replacement demo. Jeff will share the link; no invitation or message is part of this task.

## Implemented corrections

- Rummy's four coach tips remain readable at 320px and short landscape, with 44px actions. Phone settings use the existing Table menu; the stats drawer returns beneath the hand after portrait coaching. Desktop fanned cards stay still during a press, fixing a reproduced pointerdown/up mismatch that lost selections.
- All seven games report actual readiness. Required download failures, startup errors and a 12-second stall offer deliberate retry and a keyboard-usable exit. Retry preserves the URL and saves; late success removes the recovery dialog.
- Turdtris's ineffective music button and misleading help copy are removed by the importer. Sound effects and global mute remain; no Stalemate recordings/player are included.
- Accessible page headings, landmarks, named bid/chip/opponent groups, scrollable stats, modal skip-link behavior and status/decorative feedback are corrected. Native Enter activation now works for Crapjack Quick Play and Hub links in Crapjack/Spades. Turdanoid Play Again retains Boss Flush rather than switching to Classic.
- Crappy Eights uses its existing hand pager at 320px and keeps its action row visible on short phones. Homepage nav labels have a small visible gap; content and design remain intact.
- Compatible development dependency updates leave both npm audit trees at zero advisories. No production Node dependency was added or forced upgrade used.
- Preview packaging now writes a separate exact public hash manifest and verifies source identity, inventory, byte integrity, noindex, review/share identity and robots policy. Stale, modified and over-copied snapshots are rejected. The established hosting config and production gates are unchanged.

## Upstream and reproducibility

Reusable changes live in `../Turdanoid-raddad-polish/`, branch `codex/raddad-polish`, draft PR [#102](https://github.com/rupret007/Turdanoid/pull/102). The original Turdanoid checkout/branch is preserved. Current import pin:

`410cf3f9a96a2afcf05ad82f286d0e166785708d`

The importer maintains 154 explicitly public arcade files, the client inventory and server artifact allowlist. Changes belong upstream or in `scripts/sync-arcade.cjs` / `scripts/arcade/`, not only in generated `play/`. See [the preview workflow](raddad-preview.md) for exact build, verify and snapshot commands. The parent handoff records the final source/hosting commits, CI and saved deployment version after publication.

## Acceptance evidence

| Area | Evidence and result |
| --- | --- |
| Startup, narrow phones, native keyboard | Durable unit/browser regressions, four coach steps, retry and storage preservation; native card selection regression failed before the fix and passes afterward |
| Source gates | Node 22 full suite passed 1,950 tests before final semantic/keyboard additions; focused follow-ups passed. CI on the final exact upstream head runs lint, the full suite, 48 existing + 56 expanded mobile cases and browser smoke |
| Site gates | Node 24: 4 docs, 235 unit, 109 deployment/rollback checks and shellcheck passed. Final full browser rerun: 166 passed, including native keyboard return in all seven games |
| Earlier failures | Logs and videos retained. Stalled-head rAF polling was a test-driver defect, corrected without weakening assertions. A later private-lab navigation case failed once; five repeats and the full browser rerun passed. Private application source was not changed |
| Browser/layout matrix | 120 visits across Chromium, Firefox and WebKit; 320×568, 844×390, tablet and desktop. No local errors, overflow or unwanted music requests. Firefox uses responsive desktop viewports; the other small viewports emulate touch |
| Reflow/keyboard | 640×450 reflow equivalent of 200% desktop zoom; homepage/QR also use enlarged text. Keyboard focus routes, Rummy draw/select and Hub activation checked. Reduced motion and live rotation covered |
| Accessibility | Integrated initial/active scans at phone and desktop; findings interpreted and corrected. Homepage/QR text/focus contrast tests pass; actual game and result screenshots inspected. Gradients/canvas still require manual judgment |
| Card gameplay | Actual controls, read-only move planning and accelerated bot delays: Eights 64 rounds/8 matches; Spades 51 rounds/4 matches; Rummy 20 rounds/2 matches; Crapjack 8 hands. Each reached human wins and losses with scoring/results and replay |
| Arcade gameplay | Turdomania cleared an Easy board with the 1,000 bonus; Normal/Hard reached no-moves results, with undo/replay and records. Turdtris completed Sprint 40L, Ultra 120 seconds and Classic loss, pause/replay and separate records. Turdanoid cleared a Classic stage, reached natural loss, exercised Boss phases and verified mode-preserving replay |
| Media | All three real inline YouTube videos advanced playback; Escape retired their frames and returned focus. Both direct-only links opened their correct YouTube performances. Apple frames loaded only after opt-in; streaming fallbacks retained |
| Sharing | Actual result image generated/downloaded. Simulated native cancellation did not copy; denied clipboard left selectable text; keyboard inside sharing did not restart the game. No real post was sent |
| State/audio | Denied storage in every game, corrupt continue state and real Rummy refresh/continue covered. Global mute survives game start, refresh and hub return. Simulated visibility/blur freezes action games and bot tables; native control resumes and unmute are checked |

Acceptance scripts never assign game boards, scores or outcomes. Pure simulations plan legal moves; native pointer/keyboard controls execute them. Unit regression fixtures may set up specific states and are distinguished from gameplay acceptance.

## Practical limits and publication record

No physical iPhone/Android, hardware keyboard combinations or VoiceOver/NVDA session was available. CSS viewport/text enlargement is not a physical device or browser-toolbar zoom claim. Headless audio checks prove behavior/preferences, not speaker quality. Apple preview playback, paid-streaming entitlements and social sign-in behavior were not established. The entire 69-level campaigns, every power-up combination and a natural Boss victory were not completed; their rule/progression tests complement the actual play described above. These are validation limits, not claims of reproduced public defects.

Final exact-head GitHub CI, byte-for-byte regeneration, committed snapshot verification, anonymous hosted route/game/share checks and deployment IDs are recorded in `../RADDAD-PREVIEW-HANDOFF.md` and the evidence index. Publication must use only the existing independent demo after those gates pass. Keep both PRs draft/unmerged.
