// SPDX-License-Identifier: GPL-3.0-or-later
import { Chess, createGame, playMove, claimDraw, claimReason, intendedClaims, undoTurn, resign,
  loadGame, saveGame, recordResult, readResults, exportPgn, LEVELS, colorName, pieceName } from './chess-core.js';
import { ChessEngine } from './chess-engine.js';
import { pieceSvg } from './chess-pieces.js';

const $ = id => document.getElementById(id);
const suite = globalThis.Suite;
const engine = new ChessEngine();
let storage;
try { storage = globalThis.localStorage; } catch { storage = null; }
let game = loadGame(storage);
let selected = null;
let focused = 'e2';
let hintMove = null;
let reviewing = null;
let busy = false;
let failure = false;
let suspended = false;
let generation = 0;
let feedback = '';
let promotionMove = null;
let saveOk = true;
let confirmAction = null;
let claimChoices = [];
let statsSaved = true;
let opened = false;
const squares = new Map();

function cancelSearch(keepWarm = false) {
  generation++;
  if (!keepWarm || busy) { engine.cancel(); }
  busy = false;
}
function announce(message) { feedback = message; $('status').textContent = message; }
function persist() {
  if (!game) { return; }
  saveOk = saveGame(storage, game);
  if (game.result) { statsSaved = recordResult(storage, game); }
}
function syncMute() {
  const muted = suite?.isMuted?.() || false;
  $('mute').textContent = muted ? 'Sound off' : 'Sound on';
  $('mute').setAttribute('aria-pressed', String(muted));
  $('mute').setAttribute('aria-label', muted ? 'Sound off. Unmute game sounds' : 'Sound on. Mute game sounds');
}
function humanTurn() { return game && (game.mode === 'local' || game.chess.turn() === game.side); }
function livePosition() { return reviewing === null; }
function canMove() { return opened && game && !game.result && humanTurn() && livePosition() && !suspended; }
function shownChess() {
  if (reviewing === null) { return game.chess; }
  const moves = game.chess.history({ verbose: true });
  return new Chess(reviewing === 0 ? game.start : moves[reviewing - 1].after);
}
function currentFocus(square) {
  focused = square;
  for (const [name, button] of squares) { button.tabIndex = name === focused ? 0 : -1; }
}
function focusBoard(square = focused) { currentFocus(square); squares.get(square)?.focus(); }

function renderBoard() {
  if (!game) { return; }
  const chess = shownChess();
  const history = game.chess.history({ verbose: true });
  const last = history[(reviewing ?? history.length) - 1];
  const legal = selected && canMove() ? chess.moves({ square: selected, verbose: true }) : [];
  const active = document.activeElement?.dataset?.square;
  const files = [...'abcdefgh'];
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  if (game.flipped) { files.reverse(); ranks.reverse(); }
  const frag = document.createDocumentFragment();
  for (const rank of ranks) {
    for (const file of files) {
      const square = `${file}${rank}`;
      let button = squares.get(square);
      if (!button) {
        button = document.createElement('button'); button.type = 'button';
        button.dataset.square = square;
        squares.set(square, button);
      }
      const piece = chess.get(square);
      const target = legal.find(move => move.to === square);
      const checked = piece?.type === 'k' && piece.color === chess.turn() && chess.isCheck();
      const lastSquare = last && [last.from, last.to].includes(square);
      button.className = ['square', (file.charCodeAt(0) + rank) % 2 ? '' : 'dark',
        square === selected ? 'selected' : '', target ? 'legal' : '', target?.captured ? 'capture' : '',
        lastSquare ? 'last' : '', checked ? 'checked' : '', hintMove && [hintMove.slice(0, 2), hintMove.slice(2, 4)].includes(square) ? 'hinted' : ''].filter(Boolean).join(' ');
      button.innerHTML = `${piece ? pieceSvg(piece.type, piece.color) : ''}${file === files[0] ? `<span class="coord rank" aria-hidden="true">${rank}</span>` : ''}${rank === ranks[7] ? `<span class="coord file" aria-hidden="true">${file}</span>` : ''}${checked ? '<span class="check-label" aria-hidden="true">CHECK</span>' : ''}`;
      button.setAttribute('aria-label', `${square}, ${piece ? `${colorName(piece.color)} ${pieceName(piece.type)}` : 'empty'}${checked ? ', in check' : ''}${target ? target.captured ? ', legal capture' : ', legal move' : ''}${lastSquare ? ', last move' : ''}${hintMove && [hintMove.slice(0, 2), hintMove.slice(2, 4)].includes(square) ? ', hint' : ''}`);
      button.setAttribute('aria-pressed', String(selected === square));
      button.tabIndex = square === focused ? 0 : -1;
      frag.append(button);
    }
  }
  // Moving existing buttons retains listeners, but reinsertion can lose focus.
  $('board').replaceChildren(frag);
  if (active) { focusBoard(active); }
  const topColor = game.flipped ? 'w' : 'b';
  const label = color => game.mode === 'local' ? `${colorName(color)} pieces` : color === game.side ? `You · ${colorName(color)}` : `Computer · ${LEVELS[game.level].label} · ${colorName(color)}`;
  $('top-player').textContent = label(topColor);
  $('bottom-player').textContent = label(topColor === 'w' ? 'b' : 'w');
  const until = reviewing ?? history.length;
  for (const [id, color] of [['top-captured', topColor], ['bottom-captured', topColor === 'w' ? 'b' : 'w']]) {
    const captured = history.slice(0, until).filter(move => move.color === color && move.captured).map(move => pieceName(move.captured));
    // Compact, explicit text remains readable and works without a glyph font.
    const counts = ['q', 'r', 'b', 'n', 'p'].map(type => {
      const count = captured.filter(name => name === pieceName(type)).length;
      return count ? `${count} ${pieceName(type)}${count > 1 ? 's' : ''}` : '';
    }).filter(Boolean);
    $(id).textContent = counts.length ? `Captured: ${counts.join(', ')}` : 'No captures yet';
  }
  $('board').setAttribute('aria-label', `Chessboard. ${game.flipped ? 'Black' : 'White'} at bottom. ${reviewing === null ? `${colorName(chess.turn())} to move.` : `Reviewing after ${reviewing} half-moves.`} Arrow keys move focus. Enter selects or moves. Escape clears selection.`);
}
function renderHistory() {
  const activePly = document.activeElement?.dataset?.ply;
  const history = game.chess.history();
  const list = $('moves');
  list.replaceChildren();
  for (let i = 0; i < history.length; i += 2) {
    const row = document.createElement('li');
    const number = document.createElement('span'); number.textContent = `${i / 2 + 1}.`; row.append(number);
    for (let j = i; j < Math.min(i + 2, history.length); j++) {
      const move = document.createElement('button'); move.type = 'button'; move.textContent = history[j];
      move.dataset.ply = String(j + 1);
      move.setAttribute('aria-label', `Review move ${Math.floor(j / 2) + 1}, ${j % 2 ? 'Black' : 'White'}: ${history[j]}`);
      move.setAttribute('aria-current', String((reviewing ?? history.length) === j + 1));
      row.append(move);
    }
    list.append(row);
  }
  if (activePly) { list.querySelector(`[data-ply="${activePly}"]`)?.focus(); }
  $('move-count').textContent = history.length ? `· ${Math.ceil(history.length / 2)}` : '';
  $('no-moves').hidden = !!history.length;
  $('previous').disabled = (reviewing ?? history.length) <= 0;
  $('next').disabled = reviewing === null || reviewing >= history.length;
  $('live').disabled = reviewing === null;
  if (reviewing === null) { list.scrollTop = list.scrollHeight; }
}
function render() {
  if (!game || !opened) { return; }
  renderBoard(); renderHistory(); syncMute();
  const ended = game.result;
  const local = game.mode === 'local';
  $('game-label').textContent = local ? 'PASS & PLAY · UNTIMED' : `${LEVELS[game.level].label} · COMPUTER PRACTICE`;
  $('turn').textContent = reviewing !== null ? 'Reviewing moves' : ended ? ended.winner ? `${colorName(ended.winner)} wins!` : 'A well-fought draw' : `${colorName(game.chess.turn())} to move${game.chess.isCheck() ? ' · CHECK' : ''}`;
  let status = feedback;
  if (reviewing !== null) { status = `After ${reviewing} half-moves. Return to Live board to play.`; }
  else if (ended) { status = ended.reason + (ended.intended ? ` · intended move ${ended.intended}` : ''); }
  else if (suspended) { status = 'Game paused. Press Continue playing when you’re ready.'; }
  else if (busy) { status = humanTurn() ? 'Looking for a hint… You can still make your move.' : 'Computer thinking…'; }
  else if (!status) { status = game.chess.isCheck() ? 'Your king is under attack. Move out of check.' : local ? 'Pass the device after your move. Tap a piece to see its moves.' : humanTurn() ? 'Your move. Tap a piece, then a marked square.' : 'Preparing the computer…'; }
  $('status').textContent = status;
  $('save-status').classList.toggle('storage-problem', !saveOk || !statsSaved);
  $('save-status').textContent = saveOk && statsSaved ? 'Saved on this device only.' : 'Storage is unavailable. Keep this page open; download PGN to keep your moves.';
  $('hint').hidden = local;
  $('hint').disabled = !!ended || !humanTurn() || busy || !livePosition() || suspended;
  $('undo').textContent = local ? 'Undo move' : 'Undo turn';
  $('undo').disabled = !!ended || !game.chess.history().length || !livePosition() || suspended ||
    (!local && !game.chess.history({ verbose: true }).some(move => move.color === game.side));
  $('claim').disabled = !!ended || !humanTurn() || !livePosition() || busy || suspended;
  $('resign').disabled = !!ended;
  $('engine-recovery').hidden = !failure || !!ended || suspended;
  $('resume-playing').hidden = !suspended || !!ended;
  $('result').hidden = !ended;
  $('result-details').textContent = ended ? `${game.mode === 'local' ? 'Local two-player game' : `Computer practice · ${LEVELS[game.level].label}`}. ${game.chess.history().length} half-moves. ${game.hints} hints, ${game.undos} takebacks. ${ended.winner ? ended.winner === game.side && !local ? 'Nice work! Ready for another?' : 'Every game teaches you something.' : 'Want a rematch?'}` : '';
  $('mode-help').textContent = local ? 'Two players, one device. Undo takes back one move; both players should agree. Use Flip board when passing the device. Resign concedes for the side whose turn it is.' : 'Untimed practice. Undo takes back your last turn (your move and the computer reply, if played). Hints suggest a move without playing it. Hints and takebacks are counted in your result. Resign concedes your game, even during the computer’s turn.';
  const stats = readResults(storage);
  $('records').textContent = `On this device: computer ${stats.wins} wins · ${stats.losses} losses · ${stats.draws} draws. Local games: ${stats.local}. Completed games with hints/takebacks: ${stats.assisted}.`;
}
function afterMove(move) {
  selected = null; hintMove = null; feedback = '';
  focused = move.to;
  persist();
  if (game.result) { engine.cancel(); }
  if (game.result?.winner) {
    if (game.mode === 'local' || game.result.winner === game.side) { suite?.win?.(); } else { suite?.buzz?.(); }
  } else if (game.result) { suite?.ding?.(); }
  else { suite?.beep?.(move.captured ? 330 : 520, 0.045, 'triangle', 0.035); }
  render();
  animateMove(move);
  void queueComputer();
}
function animateMove(move) {
  if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { return; }
  function slide(from, to) {
    const button = squares.get(to);
    const svg = button?.querySelector('svg');
    if (!svg?.animate) { return; }
    const size = button.getBoundingClientRect().width;
    const sign = game.flipped ? -1 : 1;
    const dx = (from.charCodeAt(0) - to.charCodeAt(0)) * size * sign;
    const dy = (Number(to[1]) - Number(from[1])) * size * sign;
    button.style.zIndex = '5';
    const animation = svg.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'translate(0,0)' }], { duration: 140, easing: 'ease-out' });
    animation.finished.then(() => button.style.removeProperty('z-index')).catch(() => button.style.removeProperty('z-index'));
  }
  slide(move.from, move.to);
  if (move.flags.includes('k')) { slide(`h${move.from[1]}`, `f${move.from[1]}`); }
  if (move.flags.includes('q')) { slide(`a${move.from[1]}`, `d${move.from[1]}`); }
}
async function queueComputer(hint = false) {
  if (!opened || !game || game.result || busy || !livePosition() || suspended || document.hidden || document.querySelector('dialog[open]') || (hint ? !humanTurn() : humanTurn())) { return; }
  if (!hint && claimReason(game.chess)) { cancelSearch(); claimDraw(game); persist(); render(); return; }
  const turnGame = game;
  const fen = game.chess.fen();
  const ticket = ++generation;
  busy = true; failure = false; feedback = '';
  render();
  try {
    const move = await engine.search(game.chess.history({ verbose: true }).map(item => item.lan), game.level, { hint });
    if (!move || generation !== ticket || turnGame !== game || game.chess.fen() !== fen || game.result || suspended) { return; }
    busy = false;
    if (!game.chess.moves({ verbose: true }).some(item => item.lan === move)) { throw new Error('The computer returned an illegal move.'); }
    if (hint) {
      hintMove = move; selected = null; game.hints++;
      const choice = game.chess.moves({ verbose: true }).find(item => item.lan === move);
      feedback = `Try ${pieceName(choice.piece)} ${choice.from} → ${choice.to}${choice.promotion ? `, promote to ${pieceName(choice.promotion)}` : ''}. ${choice.san.includes('#') ? 'This is checkmate.' : choice.san.includes('+') ? 'This gives check.' : choice.flags.includes('k') || choice.flags.includes('q') ? 'Castling brings your rook into play and moves your king.' : choice.captured ? `This captures a ${pieceName(choice.captured)}.` : 'A bounded engine suggestion; compare it with your own plan.'}`;
      persist(); render();
    } else { afterMove(playMove(game, move)); }
  } catch (error) {
    if (generation !== ticket || turnGame !== game) { return; }
    busy = false; failure = true; feedback = `${error.message} Retry, or continue with a friend.`; render();
  }
}
function enterGame() {
  opened = true; suspended = false; failure = false; selected = null; hintMove = null; reviewing = null; feedback = '';
  $('setup').hidden = true; $('game').hidden = false;
  focused = game.flipped ? 'e7' : 'e2';
  persist(); render(); focusBoard();
  void queueComputer();
}
function openSetup() {
  cancelSearch(); opened = false;
  $('setup').hidden = false; $('game').hidden = true;
  $('continue').hidden = !game;
  $('continue').textContent = game?.result ? 'Review last game' : 'Continue game';
  $('saved-description').textContent = game && !game.result ? `${game.mode === 'local' ? 'Two players' : LEVELS[game.level].label + ' computer'} · ${game.chess.history().length} half-moves saved on this device.` : game?.result ? `Last game: ${game.result.reason}. Your completed result is saved.` : 'Choose an opponent and you’re ready.';
  $('mode').focus();
}
function activate(square) {
  currentFocus(square);
  if (!canMove()) { if (reviewing !== null) { announce('You are reviewing. Return to Live board to play.'); } return; }
  const piece = game.chess.get(square);
  if (selected === square) { selected = null; render(); return; }
  const options = selected ? game.chess.moves({ square: selected, verbose: true }).filter(move => move.to === square) : [];
  if (options.length) {
    if (options.some(move => move.promotion)) {
      promotionMove = { from: selected, to: square };
      $('promotion').showModal(); return;
    }
    cancelSearch(true); failure = false;
    afterMove(playMove(game, { from: selected, to: square })); return;
  }
  if (piece?.color === game.chess.turn()) {
    selected = square; hintMove = null;
    const count = game.chess.moves({ square, verbose: true }).length;
    feedback = `${colorName(piece.color)} ${pieceName(piece.type)} at ${square}. ${count ? `${count} legal destinations marked.` : 'No legal moves for this piece.'}`;
  } else { feedback = selected ? 'That move is not legal. Choose a marked square or another piece.' : 'Select one of the pieces whose turn it is.'; }
  render();
}
function review(ply) {
  cancelSearch(); selected = null; hintMove = null;
  reviewing = ply >= game.chess.history().length ? null : Math.max(0, ply);
  render();
  if (reviewing === null) { void queueComputer(); }
}
function ask(title, text, action) {
  cancelSearch(); confirmAction = action;
  $('confirm-title').textContent = title; $('confirm-text').textContent = text;
  $('confirm').showModal(); render();
}
function settings() {
  const local = $('mode').value === 'local';
  $('computer-options').hidden = local; $('local-description').hidden = !local;
  $('level-description').textContent = LEVELS[$('level').value].description;
}
$('board').addEventListener('click', event => {
  const square = event.target.closest('[data-square]')?.dataset.square;
  if (square) { activate(square); }
});
$('board').addEventListener('focusin', event => { if (event.target.dataset.square) { currentFocus(event.target.dataset.square); } });
$('board').addEventListener('keydown', event => {
  if (event.key === 'Escape') { selected = null; hintMove = null; feedback = 'Selection cleared.'; render(); event.preventDefault(); return; }
  const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  if (!directions[event.key]) { return; }
  event.preventDefault();
  const [x, y] = directions[event.key];
  const sign = game.flipped ? -1 : 1;
  const file = Math.max(0, Math.min(7, focused.charCodeAt(0) - 97 + x * sign));
  const rank = Math.max(1, Math.min(8, Number(focused[1]) + y * sign));
  focusBoard(`${String.fromCharCode(97 + file)}${rank}`);
});
$('new-game').addEventListener('submit', event => {
  event.preventDefault();
  const start = () => {
    cancelSearch();
    const side = $('side').value === 'random' ? Math.random() < 0.5 ? 'w' : 'b' : $('side').value;
    game = createGame({ mode: $('mode').value, side, level: $('level').value });
    enterGame();
  };
  if (game && !game.result && game.chess.history().length) { ask('Start a new game?', 'This replaces the unfinished chess game saved on this device.', start); }
  else { start(); }
});
$('mode').addEventListener('change', settings); $('level').addEventListener('change', settings);
$('continue').addEventListener('click', enterGame);
$('mute').addEventListener('click', () => { suite?.setMuted?.(!suite.isMuted()); syncMute(); });
$('hint').addEventListener('click', () => { void queueComputer(true); });
$('undo').addEventListener('click', () => {
  cancelSearch(); failure = false;
  const count = undoTurn(game); selected = null; hintMove = null;
  feedback = `Took back ${count} ${count === 1 ? 'move' : 'moves'}. Your turn to try another plan.`;
  persist(); render(); void queueComputer();
});
$('flip').addEventListener('click', () => { game.flipped = !game.flipped; persist(); render(); });
$('previous').addEventListener('click', () => review((reviewing ?? game.chess.history().length) - 1));
$('next').addEventListener('click', () => review((reviewing ?? game.chess.history().length) + 1));
$('live').addEventListener('click', () => review(game.chess.history().length));
$('moves').addEventListener('click', event => { const ply = event.target.closest('[data-ply]')?.dataset.ply; if (ply) { review(Number(ply)); } });
$('new').addEventListener('click', openSetup);
$('resign').addEventListener('click', () => ask('Resign this game?', `${colorName(game.mode === 'computer' ? game.side : game.chess.turn())} concedes. The result will be recorded.`, () => { resign(game); persist(); render(); }));
$('rematch').addEventListener('click', () => {
  cancelSearch(); game = createGame({ mode: game.mode, side: game.side === 'w' ? 'b' : 'w', level: game.level }); enterGame();
});
$('retry').addEventListener('click', () => { failure = false; feedback = ''; render(); void queueComputer(humanTurn()); });
$('switch-local').addEventListener('click', () => ask('Continue with a friend?', 'This becomes a local two-player game. Its result will be recorded as local play.', () => {
  game.mode = 'local'; failure = false; feedback = 'Pass-and-play. Both players now use this device.'; persist(); render();
}));
function resolveConfirmation(accepted) {
  const action = confirmAction; confirmAction = null;
  $('confirm').close();
  if (accepted) { action?.(); } else { render(); }
  void queueComputer();
}
$('confirm-no').addEventListener('click', () => resolveConfirmation(false));
$('confirm-yes').addEventListener('click', () => resolveConfirmation(true));
$('confirm').addEventListener('cancel', event => { event.preventDefault(); resolveConfirmation(false); });
$('promotion').querySelectorAll('[data-promote]').forEach(button => {
  button.innerHTML = pieceSvg(button.dataset.promote, 'w') + button.textContent;
  button.addEventListener('click', () => {
    const move = { ...promotionMove, promotion: button.dataset.promote };
    promotionMove = null; $('promotion').close(); cancelSearch(true); afterMove(playMove(game, move)); focusBoard(move.to);
  });
});
$('cancel-promotion').addEventListener('click', () => $('promotion').close());
$('promotion').addEventListener('close', () => { promotionMove = null; focusBoard(); });
function help() { cancelSearch(); $('guide').showModal(); render(); }
$('help').addEventListener('click', help); $('how-to').addEventListener('click', help);
$('close-guide').addEventListener('click', () => $('guide').close());
$('guide').addEventListener('close', () => { render(); void queueComputer(); });
$('claim').addEventListener('click', () => {
  if (claimReason(game.chess)) { claimDraw(game); cancelSearch(); persist(); render(); return; }
  claimChoices = intendedClaims(game.chess);
  $('draw-text').textContent = claimChoices.length ? 'Declare one of these moves to claim threefold repetition or the 50-move rule before playing it. The declared move will not be played.' : 'No draw is claimable in this position or with your next legal move. A claim needs three identical positions or 50 moves per side without a pawn move or capture.';
  $('draw-move').replaceChildren();
  for (const choice of claimChoices) { const option = document.createElement('option'); option.value = choice.move; option.textContent = `${choice.san} · ${choice.reason}`; $('draw-move').append(option); }
  $('draw-move').hidden = !claimChoices.length; document.querySelector('label[for="draw-move"]').hidden = !claimChoices.length;
  $('draw-confirm').hidden = !claimChoices.length;
  $('draw-dialog').showModal();
});
$('draw-cancel').addEventListener('click', () => $('draw-dialog').close());
$('draw-confirm').addEventListener('click', () => {
  if (claimDraw(game, $('draw-move').value)) { cancelSearch(); persist(); render(); }
  $('draw-dialog').close();
});
$('export').addEventListener('click', () => {
  const blob = new globalThis.Blob([exportPgn(game)], { type: 'application/x-chess-pgn;charset=utf-8' });
  const url = globalThis.URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = 'royal-flush-chess.pgn'; document.body.append(link); link.click(); link.remove();
  setTimeout(() => globalThis.URL.revokeObjectURL(url), 10000);
});
const resume = document.createElement('button'); resume.id = 'resume-playing'; resume.type = 'button'; resume.textContent = 'Continue playing'; resume.hidden = true;
$('status').after(resume);
resume.addEventListener('click', () => { suspended = false; feedback = ''; render(); void queueComputer(); });
document.addEventListener('visibilitychange', () => {
  if (!opened) { return; }
  if (document.hidden) { cancelSearch(); suspended = true; persist(); }
  render();
});
globalThis.addEventListener('pagehide', () => { cancelSearch(); persist(); suspended = true; });
globalThis.addEventListener('pageshow', event => { if (event.persisted) { render(); } });
settings(); syncMute(); openSetup();
suite?.setMusicGameBlocked?.(() => !opened || !!game?.result || suspended || !!document.querySelector('dialog[open]'));
globalThis.SuiteLoading?.ready();
