import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = fs.readFileSync(path.join(repoRoot, 'show-state.js'), 'utf8');
const windows = [];

function loadShowState() {
    const dom = new JSDOM(`<!doctype html><html><body>
        <div data-show-moment>
            <div role="status">
                <strong data-show-status>Next show</strong>
                <span data-show-detail>September 19</span>
            </div>
            <a
                id="primary-action"
                href="assets/show.ics"
                download
                data-show-primary-action
                data-upcoming-href="assets/show.ics"
                data-upcoming-label="Add to Calendar"
                data-upcoming-download="true"
                data-tonight-href="https://maps.example/show"
                data-tonight-label="Get Directions"
                data-complete-href="#watch"
                data-complete-label="Watch Rad Dad live">
                <span data-show-primary-label>Add to Calendar</span>
                <span aria-hidden="true">→</span>
            </a>
        </div>
        <p data-show-reference-prefix>The next show is</p>
        <p data-show-history-intro>The next show is locked in.</p>
        <p data-show-participation-kicker>Make some noise before the show</p>
        <p data-show-section-kicker>Hear it live</p>
        <span data-show-link-label>September 19 show</span>
        <a id="calendar" href="assets/show.ics" download data-show-calendar>Add to Calendar</a>
        <a id="directions" href="https://maps.example/show" data-show-directions>Directions</a>
        <article id="show-card" class="show-card show-card--featured" data-show-card>
            <div id="card-actions" aria-label="Next show actions" data-show-card-actions></div>
        </article>
    </body></html>`, {
        runScripts: 'dangerously',
        url: 'https://raddadband.com/'
    });

    windows.push(dom.window);
    dom.window.eval(source);
    return dom.window;
}

afterEach(() => {
    windows.splice(0).forEach((window) => window.close());
});

describe('September 19 show state', () => {
    it('uses exact Central-time boundaries for upcoming, tonight, live, and complete', () => {
        const { RadDadShowState } = loadShowState();

        expect(RadDadShowState.get(Date.parse('2026-09-18T23:59:59.999-05:00')))
            .toMatchObject({ phase: 'upcoming', status: 'Tomorrow' });
        expect(RadDadShowState.get(Date.parse('2026-09-19T00:00:00-05:00')))
            .toMatchObject({ phase: 'tonight', status: 'Tonight' });
        expect(RadDadShowState.get(Date.parse('2026-09-19T19:00:00-05:00')))
            .toMatchObject({ phase: 'live', status: 'Live now' });
        expect(RadDadShowState.get(Date.parse('2026-09-19T21:59:59.999-05:00')))
            .toMatchObject({ phase: 'live', status: 'Live now' });
        expect(RadDadShowState.get(Date.parse('2026-09-19T22:00:00-05:00')))
            .toMatchObject({ phase: 'complete', status: 'Show complete' });
    });

    it('fails closed on an invalid clock value', () => {
        const { RadDadShowState } = loadShowState();

        expect(() => RadDadShowState.get(Number.NaN)).toThrow(/finite timestamp/);
    });

    it('keeps the upcoming calendar action local and downloadable', () => {
        const { document, RadDadShowState } = loadShowState();

        const state = RadDadShowState.apply(
            document,
            Date.parse('2026-09-10T12:00:00-05:00')
        );
        const action = document.querySelector('#primary-action');

        expect(state.phase).toBe('upcoming');
        expect(document.documentElement.dataset.showPhase).toBe('upcoming');
        expect(action.getAttribute('href')).toBe('assets/show.ics');
        expect(action.hasAttribute('download')).toBe(true);
        expect(action.hasAttribute('target')).toBe(false);
        expect(action.querySelector('[data-show-primary-label]').textContent).toBe('Add to Calendar');
        expect(document.querySelector('#calendar').hidden).toBe(false);
        expect(document.querySelector('#directions').hidden).toBe(false);
    });

    it('uses the public running order while live and removes stale calendar actions', () => {
        const { document, RadDadShowState } = loadShowState();

        RadDadShowState.apply(document, Date.parse('2026-09-19T20:00:00-05:00'));
        const action = document.querySelector('#primary-action');

        expect(document.documentElement.dataset.showPhase).toBe('live');
        expect(document.querySelector('[data-show-status]').textContent).toBe('Live now');
        expect(document.querySelector('[data-show-reference-prefix]').textContent).toBe('The show is live at');
        expect(action.getAttribute('href')).toBe('https://rad-dad-show-night.jeffstory007.chatgpt.site/#official-sets');
        expect(action.getAttribute('target')).toBe('_blank');
        expect(action.getAttribute('rel')).toBe('noopener noreferrer');
        expect(action.hasAttribute('download')).toBe(false);
        expect(action.querySelector('[data-show-primary-label]').textContent).toBe('See the running order');
        expect(document.querySelector('#calendar').hidden).toBe(true);
        expect(document.querySelector('#directions').hidden).toBe(false);
        expect(document.querySelector('#card-actions').getAttribute('aria-label')).toBe('Live show actions');
    });

    it('turns the featured show into an archive and sends the primary action to videos', () => {
        const { document, RadDadShowState } = loadShowState();

        RadDadShowState.apply(document, Date.parse('2026-09-20T12:00:00-05:00'));
        const action = document.querySelector('#primary-action');
        const card = document.querySelector('#show-card');

        expect(document.documentElement.dataset.showPhase).toBe('complete');
        expect(document.querySelector('[data-show-status]').textContent).toBe('Show complete');
        expect(document.querySelector('[data-show-history-intro]').textContent).toContain('now in the archive');
        expect(document.querySelector('[data-show-link-label]').textContent).toBe('September 19 show archive');
        expect(action.getAttribute('href')).toBe('#watch');
        expect(action.hasAttribute('target')).toBe(false);
        expect(action.hasAttribute('rel')).toBe(false);
        expect(action.querySelector('[data-show-primary-label]').textContent).toBe('Watch Rad Dad live');
        expect(document.querySelector('#calendar').hidden).toBe(true);
        expect(document.querySelector('#directions').hidden).toBe(true);
        expect(card.classList.contains('show-card--featured')).toBe(false);
        expect(card.classList.contains('show-card--past')).toBe(true);
        expect(document.querySelector('#card-actions').getAttribute('aria-label'))
            .toBe('September 19 show archive actions');
    });

    it('hides a misconfigured primary action instead of guessing a destination', () => {
        const { document, RadDadShowState } = loadShowState();
        const action = document.querySelector('#primary-action');

        action.removeAttribute('data-complete-href');
        RadDadShowState.apply(document, Date.parse('2026-09-20T12:00:00-05:00'));

        expect(action.hidden).toBe(true);
    });
});
