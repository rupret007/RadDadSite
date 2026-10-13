// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(fileURLToPath(new URL('../..', import.meta.url)));
const SHIFT_ITEMS = [
    'green-day',
    'blink',
    'bowling',
    'jimmy',
    'nofx',
    'mxpx',
    'rancid',
    'nirvana',
    'taylor',
    'blur',
    'beatles',
    'pennywise',
    'me-first',
    'sublime'
];

describe('wide artist-wall overlap recovery', () => {
    it('keeps only the gap and horizontal-offset recovery, without hover or extra shadows', async () => {
        const css = await readFile(join(repoRoot, 'styles.css'), 'utf8');
        const wallStart = css.indexOf('.artist-wall {');
        const wallItemStart = css.indexOf('.artist-wall__item {');
        expect(wallStart).toBeGreaterThan(-1);
        expect(wallItemStart).toBeGreaterThan(wallStart);

        const wallBlock = css.slice(wallStart, css.indexOf('}', wallStart) + 1);
        expect(wallBlock).toContain('gap: 0.05rem clamp(0.05rem, 0.3vw, 0.28rem);');
        expect(wallBlock).not.toContain('gap: 0.2rem clamp(0.25rem, 0.65vw, 0.65rem);');

        const wallItemBlock = css.slice(wallItemStart, css.indexOf('}', wallItemStart) + 1);
        expect(wallItemBlock).toMatch(
            /transform:\s*translate\(var\(--artist-shift-x,\s*0rem\),\s*var\(--artist-shift-y,\s*0rem\)\)/
        );
        expect(wallItemBlock).not.toContain('cursor: default');
        expect(wallItemBlock).not.toContain('transition:');
        expect(wallItemBlock).not.toContain('will-change:');

        for (const item of SHIFT_ITEMS) {
            expect(css).toMatch(
                new RegExp(`\\.artist-wall__item--${item}\\s*\\{\\s*--artist-shift-x:`)
            );
        }

        expect(css).toMatch(
            /@media\s*\(max-width:\s*1080px\)[\s\S]*\.artist-wall__item\s*\{[\s\S]*--artist-shift-x:\s*0rem;/
        );

        expect(css).not.toMatch(/@media\s*\(hover:\s*hover\)\s*\{[\s\S]*\.artist-wall__item:hover/);
        expect(css).not.toContain('0 14px 24px rgba(0, 0, 0, 0.22)');
        expect(css).not.toContain('drop-shadow(0 16px 24px rgba(0, 0, 0, 0.4))');
        expect(css).not.toContain('scale(1.08)');
    });
});
