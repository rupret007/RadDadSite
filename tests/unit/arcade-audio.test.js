// @vitest-environment node
import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = file => readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
describe('canonical Rad Dad audio selection', () => {
    it('opts in the hub and all nine games while keeping legacy Neon classic', () => {
        for (const game of ['index', 'TurdAnoid', 'turdtris', 'turdjack', 'crapeights', 'turdrummy', 'turdspades', 'turdomania', 'chess', 'turdrush']) {
            expect(read(`play/${game}.html`)).toContain('data-arcade-audio="studio"');
        }
        expect(read('play/neon-arkanoid.html')).not.toContain('data-arcade-audio="studio"');
        expect(read('play/assets/turdsuite.js')).toContain("document.documentElement.dataset.arcadeAudio === 'studio'");
    });
    it('includes only the procedural effects bank and no inactive music controls', () => {
        expect(existsSync(new URL('../../play/assets/suite-sound.js', import.meta.url))).toBe(true);
        expect(existsSync(new URL('../../play/assets/suite-music.js', import.meta.url))).toBe(false);
        expect(read('play/assets/turdsuite.js')).toContain('isMusicEnabled() { return false; }');
        expect(read('play/assets/turdsuite.js')).not.toContain('m.createSuiteMusic(');
        expect(read('play/turdtris.html')).not.toContain('id="musicToggle"');
    });
});
