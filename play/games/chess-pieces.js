// SPDX-License-Identifier: GPL-3.0-or-later
// Original vector silhouettes for this arcade. No font/emoji or remote art dependency.
const paths = {
  p: '<circle cx="24" cy="15" r="7"/><path d="M20 23h8l2 12H18zM16 36h16l3 6H13z"/>',
  r: '<path d="M11 7h7v7h4V7h5v7h4V7h6v13l-6 4 1 11H16l1-11-6-4zM13 36h22v6H13z"/>',
  n: '<path d="m14 6 7 4 9 1 8 12-10 4-6-5-3 13h15l3 7H11l2-12 5-11-7 2-2-5z"/><path d="m22 15 3 1" fill="none" stroke-width="3" stroke-linecap="round"/>',
  b: '<path d="M24 5c-3 5-12 10-11 17 0 5 6 8 11 8s11-3 11-8C36 15 27 10 24 5zM20 30h8l3 6H17zM15 36h18l4 6H11z"/><path d="m28 11-9 12" fill="none" stroke-width="3" stroke-linecap="round"/>',
  q: '<path d="m11 14 6 8 7-13 7 13 6-8-5 21H16zM14 36h20l3 6H11z"/><circle cx="10" cy="11" r="3"/><circle cx="24" cy="7" r="3"/><circle cx="38" cy="11" r="3"/>',
  k: '<path d="M22 4h4v5h5v4h-5v5h-4v-5h-5V9h5zM12 22c0-7 9-6 12-2 3-4 12-5 12 2 0 5-5 8-6 13H18c-1-5-6-8-6-13zM15 36h18l4 6H11z"/>'
};
// Rule reminders, not tactical evaluations. The legal-move generator still
// decides which destinations are safe in the current position.
export const PIECE_GUIDE = Object.freeze({
  p: { name: 'Pawn', reminder: 'Pawns move forward into empty squares and capture diagonally.', detail: 'One square toward the far end, or two from its starting square if clear. Captures one square diagonally.' },
  n: { name: 'Knight', reminder: 'Knights jump two squares one way and one across.', detail: 'An L shape: two squares in one direction, then one across. The only piece that can jump over others.' },
  b: { name: 'Bishop', reminder: 'Bishops move diagonally without jumping over pieces.', detail: 'Any distance diagonally, staying on the same square color. Other pieces block its path.' },
  r: { name: 'Rook', reminder: 'Rooks move along a row or column without jumping over pieces.', detail: 'Any distance along a row or column. Other pieces block its path.' },
  q: { name: 'Queen', reminder: 'Queens move straight or diagonally without jumping over pieces.', detail: 'Any distance along a row, column or diagonal. Other pieces block its path.' },
  k: { name: 'King', reminder: 'Kings move one square, or castle when allowed. Keep your king out of check.', detail: 'One square in any direction, always out of attack. Castling is a special move explained below.' }
});
export function pieceSvg(type, color) {
  const white = color === 'w';
  return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g fill="${white ? '#fff6dc' : '#192638'}" stroke="${white ? '#192638' : '#fff6dc'}" stroke-width="1.8" stroke-linejoin="round">${paths[type] || ''}</g></svg>`;
}
