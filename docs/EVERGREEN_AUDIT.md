# Evergreen public-site assessment and implementation

Assessment date: October 2, 2026. Base: `04606272ef32a2d7a76203661834aea82eed1b75`.

## Findings addressed

| Priority | Finding | Implemented response |
| --- | --- | --- |
| Critical content | Homepage title, share cards, MusicEvent markup, hero and calls to action still promoted September 19. | Evergreen cover-band title, descriptions, MusicGroup metadata and band-logo preview. The event is confined to a dated Past show card. |
| Critical content | The Story Of Us wording implied songwriting/original ownership. | Explicit Taylor Swift cover credit beside the song and in QR metadata. The linked recording remains credited to Jeff Story. |
| High | QR page repeated the same expired invitation and confusing "own cover" story. | Music-first QR content, accurate recording credit, shared social header and links to current show updates. |
| High | A second GPT page could keep outdated copy alive independently. | Same-origin relative redirect with canonical metadata, noindex and a no-JavaScript fallback. |
| High | Listening and booking were buried below event promotion and a large artist wall. | Watch and Book actions in the first screen; live recordings precede the artist wall; direct booking remains in the main contact section. |
| High | The band's identity was largely absent. | Cover-band introduction and a compact first-name/instrument lineup. No invented photographs, bios or endorsements. |
| Medium | Automatic player loading adds unnecessary provider contact. | Optional Apple Music preview uses a dormant template, activated only by a click. Real streaming links always remain visible. Existing on-demand YouTube behavior is preserved. |
| Medium | Sticky-header height changed across breakpoints. | Shared responsive header and runtime height measurement; no-JavaScript CSS offsets remain. Touch and focus targets are retained. |
| Medium | Date-specific sharing could send obsolete event details. | A new explicit Share Rad Dad action sends only the fixed canonical band URL, never the current query or private fragment. Cancellation never silently copies. |
| Medium | Tests asserted an old show was upcoming according to the runner clock. | Public tests now exercise the evergreen behavior across historical, current and future dates. Legacy controller contracts are retained using a narrow test-only fixture. |
| Medium | Old assets and printed URLs could be accidentally broken in cleanup. | Flyer/calendar bytes and permanent `/tap/` and `/nfc/` redirects are preserved. They are no longer active promotional actions. |

## Scope and facts

The user explicitly clarified that Rad Dad is a cover band and The Story Of Us is a Taylor Swift cover. Existing social profiles, performance URLs, streaming release IDs, contact destinations, artist roster and historic show dates are preserved. The About section uses first names and instrument roles already supplied by the user.

No new upcoming date was supplied. "No upcoming dates posted yet" is intentionally not a statement that the band has no bookings. No fictional testimonials, set durations, prices, streaming platforms, venues or photographs were added. No live audio is autoplayed on page entry.

The original logo is used as the evergreen social image with its true 1024 × 1024 JPEG dimensions and a summary card. No expired poster remains in current social metadata. The shared CSS keeps the existing `qr/styles.css` path so production inventory and server-helper policy remain unchanged.

## Evidence and validation boundaries

The published pages were inspected at `https://raddadband.com/` and `https://raddadband.com/qr/`; repository source was checked independently. Google's official Organization structured-data documentation supports using the most specific organization subtype and real identity/social-profile data. No search-result, ranking or rich-result appearance is guaranteed.

Local unit tests cover all 166 existing/new contracts. Layout previews render exact local HTML/CSS/images at 320, 390 and 1440 CSS pixels. The local browser's administrator policy blocks loopback navigation, so previews use an offline document rather than claiming full local end-to-end tests. External video thumbnails and web fonts are synthetic/fallback in offline checks. Hosted Chromium tests and production verification must pass before merge; record their result in the PR.

Obsolete event-promotion browser scenarios are replaced by evergreen coverage, not skipped or mislabeled as passing. Legacy sharing and visit-planning unit tests target `tests/fixtures/legacy-show.html`. Current pages do not load that controller. Unchanged inline-player recovery, private-path, Worker and deployment/rollback coverage remains active.

## Remaining operational work

Publication through Che's public-domain hosting is separate from merging. No production gates, credentials, virtual hosts or remote server settings were changed. The runbook's discovery/cutover requirements remain in force. A successful source merge is not evidence of a live deployment.

The old backup directory and unrelated private band-lab sources are intentionally left intact and excluded from the clean production artifact. If the legacy server still serves those repository-only paths, its documented clean-artifact deployment work is still required; a content edit does not secure a server document root.

A real approved band photograph and fresh verified performance clips would be useful future editorial additions. They were not invented or sourced from an unrelated band for this update.
