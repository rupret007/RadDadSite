# Rad Dad design preview

Review URL: https://rad-dad-design-preview.jeffstory007.chatgpt.site/

This is the blue/lime Rad Dad design, with the five original live clips, homework invitation and seven games. It preserves cover credits, contacts, members, recording links, historical shows, printed `/tap/` and legacy `/nfc/` routes. It does not display an empty upcoming-shows notice.

The established site at raddadband.com and RadDadSite main are outside this release. The existing source `.openai/hosting.json` identifies that established site; never copy or deploy it for this review. The demo has its own project, `appgprj_6adc6437250c81919a5aee09cb9d91a5`, and separate hosting checkout `../RadDadDesignPreview/`. Its provider `main` branch is not RadDadSite main. Reuse this project and URL rather than creating another site or changing domains/access.

## Repeatable build and snapshot

Use the tested Node 24 runtime for RadDadSite. Commit the reviewed source before building the release snapshot. The importer defaults to the full revision pinned in `scripts/sync-arcade.cjs`; for a local committed upstream checkout:

```sh
node scripts/sync-arcade.cjs --source ../Turdanoid-raddad-polish
git diff --exit-code -- play scripts/arcade/client-paths.json scripts/deploy/server-deploy.sh
npm test
npm run lint:deploy
npm run build:preview
RAD_DAD_REVIEW_SHA=$(git rev-parse HEAD)
npm run verify:production -- --expected-sha "$RAD_DAD_REVIEW_SHA"
npm run verify:preview -- --expected-sha "$RAD_DAD_REVIEW_SHA"
```

The preview builder starts from the verified explicit public inventory. It retains sound effects, excludes Stalemate recordings and private band tools, adds the preview label/share mode and noindex, and uses this demo's URLs for social metadata. Five unused legacy print/social PNG exports are omitted only from the preview, after checking they are unreferenced. Source and normal clean artifacts retain them.

After confirming the separate checkout's config still names the independent project, copy only public bytes and verify them again:

```sh
rsync -a --delete preview-dist/ ../RadDadDesignPreview/dist/client/
npm run verify:preview -- --artifact-dir ../RadDadDesignPreview/dist/client --expected-sha "$RAD_DAD_REVIEW_SHA"
```

Do not copy this repository or its established hosting config wholesale. Commit the exact independent snapshot with its source SHA recorded in its README. Push only the review feature branch and that separate provider snapshot. Archive the committed snapshot's `.openai/hosting.json` and `dist/client/`, save a new version on the same independent project and deploy that version through Sites. Vercel is not part of this workflow. Never merge/push RadDadSite main or change production gates as a side effect.

## Verification and evidence

The preview verifier rejects mismatched source versions, unexpected files, symlinks, changed bytes, missing review identity and indexing-policy drift. Its manifest stays outside the public tree. Clean artifact verification remains independent of preview verification; preview transforms intentionally change HTML bytes.

After publication, verify anonymously: source version, review/noindex labels, homepage and QR sharing of the review origin, preserved route aliases, all seven game starts, clean game URLs, saved-table continuation, result links and recovery controls. Inspect actual rendered desktop and phone screenshots, and distinguish provider mocks, real playback, emulated devices and physical-device checks.

Initial design evidence: `../release-evidence/raddad-preview/`. The new audit is in `../release-evidence/raddad-deep-audit-2026-10-24/`; ongoing polish checks are in `../release-evidence/raddad-polish/` and [the progress record](raddad-polish.md). The parent workspace's `RADDAD-PREVIEW-HANDOFF.md` records exact published versions and deployment status.
