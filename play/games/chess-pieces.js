// SPDX-License-Identifier: GPL-3.0-or-later
// Original vector silhouettes for this arcade. No font/emoji or remote art dependency.
const paths = {
  p: '<circle cx="24" cy="15" r="7"/><path d="M20 23h8l2 12H18zM16 36h16l3 6H13z"/>',
  r: '<path d="M11 7h7v7h4V7h5v7h4V7h6v13l-6 4 1 11H16l1-11-6-4zM13 36h22v6H13z"/>',
  n: '<path d="m14 6 7 4 9 1 8 12-10 4-6-5-3 13h15l3 7H11l2-12 5-11-7 2-2-5z"/><path d="m22 15 3 1" class="piece-detail"/>',
  b: '<path d="M24 5c-3 5-12 10-11 17 0 5 6 8 11 8s11-3 11-8C36 15 27 10 24 5zM20 30h8l3 6H17zM15 36h18l4 6H11z"/><path d="m28 11-9 12" class="piece-detail"/>',
  q: '<path d="m11 14 6 8 7-13 7 13 6-8-5 21H16zM14 36h20l3 6H11z"/><circle cx="10" cy="11" r="3"/><circle cx="24" cy="7" r="3"/><circle cx="38" cy="11" r="3"/>',
  k: '<path d="M22 4h4v5h5v4h-5v5h-4v-5h-5V9h5zM12 22c0-7 9-6 12-2 3-4 12-5 12 2 0 5-5 8-6 13H18c-1-5-6-8-6-13zM15 36h18l4 6H11z"/>'
};
export function pieceSvg(type, color) {
  const white = color === 'w';
  return `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g fill="${white ? '#fff6dc' : '#192638'}" stroke="${white ? '#192638' : '#fff6dc'}" stroke-width="1.8" stroke-linejoin="round">${paths[type] || ''}</g><style>.piece-detail{fill:none;stroke-width:3;stroke-linecap:round}</style></svg>`;
}
