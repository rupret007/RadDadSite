import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const htmlPath = path.join(repoRoot, 'index.html');
const scriptPath = path.join(repoRoot, 'script.js');
const rawHtml = fs.readFileSync(htmlPath, 'utf8').replace(/<script src="script\.js"><\/script>/i, '');
const scriptSource = fs.readFileSync(scriptPath, 'utf8');

function loadHomepage() {
    const dom = new JSDOM(rawHtml, {
        pretendToBeVisual: true,
        runScripts: 'dangerously',
        url: 'http://127.0.0.1:4173/'
    });
    const { window } = dom;
    const observerInstances = [];

    class MockIntersectionObserver {
        constructor(callback, options) {
            this.callback = callback;
            this.options = options;
            this.observedElements = [];
            observerInstances.push(this);
        }

        observe(element) {
            this.observedElements.push(element);
        }

        unobserve(element) {
            this.observedElements = this.observedElements.filter((entry) => entry !== element);
        }

        disconnect() {
            this.observedElements = [];
        }
    }

    window.setTimeout = setTimeout;
    window.clearTimeout = clearTimeout;
    window.requestAnimationFrame = vi.fn((callback) => window.setTimeout(() => callback(0), 0));
    window.cancelAnimationFrame = vi.fn((handle) => window.clearTimeout(handle));
    window.IntersectionObserver = MockIntersectionObserver;
    window.console = console;
    window.eval(scriptSource);
    window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

    return {
        dom,
        document: window.document,
        observerInstances,
        window
    };
}

describe('homepage script behavior', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('creates exactly one logo fallback after repeated logo load errors', () => {
        const { document, window } = loadHomepage();
        const logo = document.getElementById('logo');

        logo.dispatchEvent(new window.Event('error'));
        logo.dispatchEvent(new window.Event('error'));

        expect(logo.style.display).toBe('none');
        expect(document.querySelectorAll('.logo-fallback')).toHaveLength(1);
        expect(document.querySelector('.logo-fallback').textContent).toContain('Rad Dad');
    });

    it('adds and removes a ripple when a show link is clicked', () => {
        vi.useFakeTimers();
        const { document, window } = loadHomepage();
        const showLink = document.querySelector('.show-link');

        showLink.getBoundingClientRect = () => ({
            bottom: 40,
            height: 40,
            left: 0,
            right: 180,
            top: 0,
            width: 180,
            x: 0,
            y: 0
        });

        showLink.dispatchEvent(new window.MouseEvent('click', {
            bubbles: true,
            clientX: 40,
            clientY: 20
        }));

        expect(showLink.querySelectorAll('.ripple')).toHaveLength(1);

        vi.advanceTimersByTime(600);

        expect(showLink.querySelectorAll('.ripple')).toHaveLength(0);
    });

    it('initializes animated sections and registers them with the observer', () => {
        const { document, observerInstances } = loadHomepage();
        const sections = Array.from(document.querySelectorAll('.festival-section, .video-section, .shows-section, .social-section, .contact-section'));

        expect(sections).toHaveLength(5);
        sections.forEach((section) => {
            expect(section.style.opacity).toBe('0');
            expect(section.style.transform).toBe('translateY(20px)');
            expect(section.style.transition).toBe('opacity 0.6s ease, transform 0.6s ease');
        });

        expect(observerInstances).toHaveLength(1);
        expect(observerInstances[0].observedElements).toHaveLength(sections.length);
        sections.forEach((section) => {
            expect(observerInstances[0].observedElements).toContain(section);
        });
    });

    it('applies the hover transition to every video container', () => {
        const { document, window } = loadHomepage();
        const videoContainers = Array.from(document.querySelectorAll('.video-container'));

        expect(videoContainers.length).toBe(2);

        videoContainers.forEach((videoContainer) => {
            videoContainer.dispatchEvent(new window.Event('mouseenter', { bubbles: true }));
            expect(videoContainer.style.transition).toBe('all 0.3s ease');
        });
    });
});
