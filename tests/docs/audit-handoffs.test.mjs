import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const prose = path => read(path).replace(/\s+/g, ' ');

// These are dated audit receipts, not a promise about the growing unit suite.
for (const file of ['EVERGREEN_AUDIT.md', 'BAND_WALL_HANDOFF.md']) {
    test(`${file} records the October 10 audit counts and verification limits`, () => {
        const doc = prose(`docs/${file}`);
        assert.match(doc, /October 10, 2026 audit/);
        assert.match(doc, /`npm run test:unit`[^.]*167/);
        assert.match(doc, /`npm run test:deploy`[^.]*85/);
        assert.doesNotMatch(doc, /\b166\b/);
        assert.match(doc, /Chromium e2e[^.]*NOT RUN[^.]*audit/);
        assert.match(doc, /Live hosting[^.]*NOT RUN[^.]*audit/);
    });
}

test('recovery handoff describes the evergreen homepage contract', () => {
    const doc = prose('docs/PUBLIC_LINK_RECOVERY.md');
    assert.match(doc, /recovered homepage does not load `show-state\.js`/);
    assert.match(doc, /`data-show-phase` is absent/);
    assert.match(doc, /`window\.RadDadShowState` is undefined/);
    assert.doesNotMatch(doc, /stylesheet and show-state loading/);
    assert.doesNotMatch(doc, /It exercises[^.]*calendar download/);
    assert.match(doc, /Chromium e2e[^.]*NOT RUN[^.]*audit/);
    assert.match(doc, /Live hosting[^.]*NOT RUN[^.]*audit/);

    // Check the documented script boundary against both actual public pages.
    for (const page of ['index.html', 'qr/index.html']) {
        assert.doesNotMatch(read(page), /<script\b[^>]*\bsrc=["'][^"']*show-state\.js/i);
    }
});

test('sharing handoff separates legacy fixtures from current page coverage', () => {
    const doc = prose('docs/SHOW_SHARING.md');
    assert.match(doc, /## Historical behavior/);
    assert.match(doc, /current homepage and QR page use `script\.js`/);
    assert.match(doc, /`tests\/unit\/show-share\.test\.js`[^.]*`tests\/fixtures\/legacy-show\.html`/);
    assert.match(doc, /`tests\/e2e\/show-share\.spec\.js`[^.]*current[^.]*Share Rad Dad/);
    assert.doesNotMatch(doc, /Fans can share one complete show note from the existing homepage/);
});
