# Legacy Apache source boundary

The existing repository-root mirror serves files outside the clean production
artifact. Anonymous checks on October25 found200 responses for source/config
files, old GPT/backup pages and the five historical root ZIP archives. The
same representative paths responded on raddadband.com, its www host and
lazypunksunite.com. Status/headers were recorded without reading those bodies.
The configured Sites Worker's recovery filter cannot protect this Apache path.

The root `.htaccess` adds only three `RedirectMatch 404` directives: exact
nonpublic root directories, exact nonpublic/config root filenames and the five
named historical ZIPs. Matching is case-insensitive and respects path-segment
boundaries. All tracked nonpublic root entries are covered. The focused test
compares that policy with the explicit public inventory and tracked roots, so
future source-only root additions require a guard decision before release.

Public HTML, styles, scripts, media and route content stay untouched. Public
QR/tap/NFC behavior, `.well-known`, similarly named public paths, and the named
GPL source archives under `play/assets/chess/` remain available. These rules do
not block JavaScript or archives by extension. Two unreferenced historical root
poster JPGs are excluded consistently with the existing public artifact; current
public poster assets remain unchanged.

Apache documents `RedirectMatch` for `.htaccess` with the `FileInfo` override
class; numeric404 uses no destination. The host must enable `mod_alias` and
permit these overrides. See [mod_alias](https://httpd.apache.org/docs/2.4/mod/mod_alias.html#redirectmatch)
and [per-directory configuration](https://httpd.apache.org/docs/2.4/howto/htaccess.html).
No server, DNS, virtual-host or system-Apache configuration is changed by this
repository patch. The three directives are intentionally not hidden behind a
fail-open module check.

This file is for the existing root mirror. The explicit `dist/client` inventory
continues to exclude `.htaccess` and source/build files; clean-artifact hosting
and the existing Sites Worker retain their separate boundary mechanisms. The
clean-release runbook's `AllowOverride None` model remains unchanged.

Local qualification used real Apache2.4.67 with `AllowOverride FileInfo`, an
isolated temporary root, exact public payload copies and harmless source-path
sentinels. All46 sentinels were readable before the guard. Afterward276 GET/HEAD
checks across the three host names returned404 without redirect or sentinel
content; all222 public files remained byte-identical, six boundary neighbors
including `.well-known` stayed available and QR/tap directory301s retained
their query. Focused Apache/Worker units passed107/107. No actual private source
contents were used in the local fixture.

Publication acceptance still requires anonymous plain-path checks on the actual
mirror: homepage/game assets must have no500s, and forbidden paths must stop
returning200, including previously cacheable ZIP URLs. Preserve raw statuses and
cache headers; a query-busted404 alone is not sufficient. Upstream Cloudflare
already returns403 for some dot paths before Apache; record those as blocked
edge responses separately, without claiming this guard changes their status.
Local qualification is not evidence that the remote host honors `.htaccess`.
