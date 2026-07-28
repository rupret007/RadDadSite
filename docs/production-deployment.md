# Production deployment runbook

This runbook covers `raddadband.com`. GitHub Pages and the ChatGPT Sites
deployment remain independent and are not changed by this production path.

## Safety model

Production deployments follow this path:

1. GitHub checks out one exact commit and runs the complete automated test
   suite.
2. That same job builds `dist/client`, writes the commit identity into
   `version.json`, and verifies every entry in `artifact-manifest.json` and
   `SHA256SUMS`.
3. GitHub stores only the verified `dist/client` payload as the deployment
   artifact. Repository source, tests, old ZIP files, backups, and build tools
   are not included.
4. A separate deployment job downloads that artifact from the same workflow
   run. The job can run only for `main`, uses the protected GitHub Environment
   named `production`, and serializes releases so two production activations
   cannot overlap.
5. The server validates the uploaded archive and SHA in a private staging
   directory, installs a versioned release, atomically changes the `current`
   symlink, and checks the public `version.json`. A failed check restores the
   previous symlink automatically.

The first rollout is manual and should require a GitHub Environment reviewer.
Automatic deploys from `main` stay disabled until the rollout and rollback
drill have both succeeded.

## Repository access for Che

The public repository can be cloned without a GitHub sign-in:

```bash
git clone https://github.com/rupret007/RadDadSite.git
```

That clone is source material, not the production web root. If a clone is kept
on the server, place it outside Apache's `DocumentRoot`, for example under
`/srv/raddad/source`. The deployment workflow transfers only the verified
`dist/client` artifact; it does not publish the clone.

## Information to confirm before server changes

Che and Jeff should confirm the following before the first dry run:

- SSH hostname, port, and dedicated non-root deployment username
- the exact Apache `DocumentRoot` and its current owner/group
- whether `raddadband.com` and `lazypunksunite.com` intentionally share that
  `DocumentRoot`
- the private releases, incoming/staging, and `current` symlink paths
- whether Apache is allowed to follow the `current` symlink
- files that must remain shared rather than versioned, especially
  `.well-known`, `.htaccess`, uploads, analytics verification files, or other
  operator-managed files
- the narrow permissions or `sudo` commands, if any, needed by the deployment
  account
- who will configure the GitHub `production` Environment and approve the first
  production activation

Do not paste a password, private key, token, or unredacted secret into GitHub
issues, pull requests, this repository, or chat.

Before altering the virtual host or moving any files, record the current Apache
configuration, ownership, symlink resolution, and public-file inventory. Take a
restorable host snapshot or a verified backup of the current `DocumentRoot`
through the hosting control plane, and record who can restore it. Do not remove
the old tree until the new release and rollback have been proven.

## Server layout

A representative layout is:

```text
/srv/raddad/
|-- incoming/                 # private uploads; not served by Apache
|-- releases/
|   |-- <40-character-sha>/
|   `-- ...
|-- shared/                   # optional operator-managed persistent files
`-- current -> releases/<40-character-sha>
```

Apache should serve `/srv/raddad/current`, either directly as its
`DocumentRoot` or through a deliberately configured symlink. Changing
`DocumentRoot` alone is not sufficient on every Rocky/Apache configuration:
Che must inspect the applicable, narrowly scoped `<Directory>` authorization
for this path (and the server's symlink policy), then configure read access and
`FollowSymLinks` only as required by the confirmed virtual-host policy. Do not
broaden access to `/srv` or copy a generic stanza over an existing security
policy. The deployment account should own only the incoming, releases, and
`current` entries it needs. It should not be root and should not have broad
write access to Apache, certificates, other virtual hosts, or the rest of
`/srv`.

If `.well-known` is needed for certificate renewal, keep it outside the
versioned artifact and map or link it from a server-owned shared directory.
Use the same pattern for any truly persistent upload or verification file.

Before changing `DocumentRoot`, inspect both virtual hosts. The two domains
currently appear capable of serving the same files; deleting or replacing a
shared root without confirming that relationship could alter both sites.

### Install the server-owned helper

The checked-in [`scripts/deploy/server-deploy.sh`](../scripts/deploy/server-deploy.sh)
is infrastructure code, not a public site file. After review, Che should install
that exact file outside the web root:

```bash
sudo install -o root -g root -m 0755 scripts/deploy/server-deploy.sh /usr/local/libexec/raddad-deploy
sudo install -o root -g root -m 0644 docs/raddad-deploy.conf.example /etc/raddad-deploy.conf
```

Edit `/etc/raddad-deploy.conf` only after confirming the real release path and
health-check origin. The example contains no credentials. The workflow verifies
that the installed helper's SHA-256 matches the helper in the exact tested
commit before it uploads or activates a release. If the helper itself changes,
review and reinstall it before the next production dry run.

The helper requires Bash, Python 3, and curl from the server's trusted package
repositories. Confirm them before rollout:

```bash
command -v bash python3 curl
```

After substituting the confirmed deployment account and Apache read-only group,
pre-create the private incoming, release, and staging directories; the helper
intentionally refuses to create or guess them. On Rocky Linux the Apache group
is often `apache`, but Che must verify it:

```bash
sudo install -d -o raddad-deploy -g apache -m 0750 \
  /srv/raddad \
  /srv/raddad/releases
sudo install -d -o raddad-deploy -g raddad-deploy -m 0700 \
  /srv/raddad/incoming \
  /srv/raddad/.staging
```

This gives Apache traverse/read access to completed releases without access to
incoming artifacts or work-in-progress extraction. Keep the config and
installed helper root-owned. No directory in this layout should be beneath the
old or new public `DocumentRoot`, except the selected `current` release target.

On an SELinux-enforcing Rocky host, Che must also create a persistent
`semanage fcontext` rule and run `restorecon` so Apache may read files after
they move from `.staging` into `releases`. Keep the incoming and staging
directories blocked by their Unix permissions, verify the resulting labels,
and never disable SELinux just to make the deployment work.

## GitHub configuration

Create a GitHub Environment named `production` and configure:

- Jeff and Che's GitHub accounts as reviewers when both have repository access,
  with at least one approval from someone other than the person who started the
  deployment
- **Prevent self-review** enabled
- administrator bypass disabled for the controlled first rollout
- a deployment branch rule that allows only `main`
- environment secrets only for credentials
- environment variables for non-secret connection and deployment settings

Required Environment secrets:

| Secret | Purpose |
| --- | --- |
| `PROD_SSH_PRIVATE_KEY` | Private key for the dedicated deployment account |
| `PROD_SSH_KNOWN_HOSTS` | Pinned, Che-verified SSH host-key line |

Required repository variables:

| Variable | Example | Purpose |
| --- | --- | --- |
| `PROD_SITE_URL` | `https://raddadband.com` | Link shown for the GitHub deployment |
| `PROD_AUTO_DEPLOY_ENABLED` | `false` | Enables push-to-`main` deploys only after validation |

Required `production` Environment variables:

| Variable | Example | Purpose |
| --- | --- | --- |
| `PROD_HOST` | `raddadband.com` | SSH hostname |
| `PROD_PORT` | `22` | SSH port |
| `PROD_USER` | `raddad-deploy` | Dedicated deployment account |
| `PROD_STAGE_ROOT` | `/srv/raddad/incoming` | Private remote upload directory |

Configure `PROD_AUTO_DEPLOY_ENABLED` as a repository variable because GitHub
must evaluate it before starting the Environment-protected job. Never make it a
secret. An absent value and any value other than the lowercase string `true`
keep automatic deployment disabled. `PROD_SITE_URL` is also repository-scoped
because GitHub resolves the deployment URL before the runner loads
Environment-level variables. The SSH connection values remain scoped to the
`production` Environment.

The release root is deliberately **not** supplied by the workflow. The
root-owned `/etc/raddad-deploy.conf` controls `RADDAD_RELEASE_ROOT`, so a
repository or variable change cannot redirect release creation, symlink swaps,
or retention cleanup to another server directory.

### Pin the SSH host key

Che should obtain the server's current public host-key fingerprint from the
server or hosting control plane and compare it out of band with the key seen
from a trusted network. Store the resulting complete `known_hosts` line in
`PROD_SSH_KNOWN_HOSTS`. For a non-default port, the host field normally uses
`[hostname]:port`.

The workflow deliberately uses `StrictHostKeyChecking=yes`. Do not replace the
pinned value with `ssh-keyscan` inside the workflow and do not disable host-key
checking.

### Least-privilege SSH key

Create a new key used only by GitHub Actions. Authorize its public half for the
dedicated deployment account. Do not reuse a personal administrator key. Give
that account no broad `sudo` access and grant filesystem access only to its
private incoming directory and the Rad Dad release layout.

The current workflow uses SCP/SFTP plus narrowly constructed `test`,
`sha256sum`, cleanup, and helper commands over SSH. A helper-only forced command
would therefore break it. Add a forced command only if Che first installs and
tests a reviewed dispatcher that explicitly supports those exact operations;
otherwise rely on the dedicated account, restrictive ownership, and no `sudo`
as the least-privilege boundary.

Add the private half directly to the GitHub Environment secret through GitHub's
settings UI. It must never be committed or sent in chat.

## Bootstrap the clean release layout

The current legacy web root is not a valid rollback release: it publicly
contains repository files and has no verified `version.json`. Do not copy that
tree into `releases/` or use it as the rollback target.

The first Apache cutover needs one clean prepared release before the public
virtual host can health-check through `current`:

1. Keep Apache pointed at the existing web root and retain its verified backup.
2. Run the protected workflow on the exact reviewed `main` SHA with
   `production_action=dry-run`.
3. Run it again with `production_action=prepare`. The helper validates and
   installs `releases/<sha>` but deliberately does not change `current`.
4. With Che watching the virtual host, create `current` only if it is absent:

   ```bash
   test ! -e /srv/raddad/current
   ln -s "releases/<prepared-40-character-sha>" /srv/raddad/current
   ```

5. Change only the confirmed `raddadband.com` Apache `DocumentRoot` to
   `/srv/raddad/current`. Confirm that its scoped `<Directory>` authorization
   and symlink policy allow Apache to traverse and read the selected release
   without granting broader `/srv` access. On an SELinux-enforcing host, inspect
   the labels with `ls -lZ`, confirm the persistent `semanage fcontext` rule,
   and run `restorecon` before cutover. Run `apachectl configtest` (or the
   host's confirmed equivalent) and reload Apache only after every check
   passes. If health fails, immediately restore the backed-up virtual-host
   configuration; do not delete the legacy tree.
6. Verify the public `version.json`, page, and assets, then run the workflow
   with `production_action=deploy` for that same SHA. Because `current` already
   identifies the verified release, this confirms the normal health-check path
   without replacing content.

This establishes one compliant baseline. The rollback drill requires a second
reviewed `main` SHA: deploy that next SHA, roll back to the prepared baseline,
verify it, and then redeploy the newer SHA. Never claim rollback is tested when
only one compliant release exists.

## Controlled first rollout

Keep `PROD_AUTO_DEPLOY_ENABLED=false` while completing this checklist:

1. Merge the reviewed automation only after Jeff and Che approve the paths,
   permissions, virtual-host relationship, and preserved files.
2. Confirm the normal `Test, Package, and Deploy Site` workflow passes on the
   exact `main` commit.
3. Run the protected `dry-run`; a non-initiating reviewer must approve the
   Environment gate. Its log must identify the intended release and paths
   without changing `current`.
4. For the first cutover, complete the `prepare` and Apache steps in the
   clean-layout bootstrap above. Record Jeff's and Che's approval of the
   observed paths and result.
5. Run the protected workflow with `production_action=deploy` for the exact
   current `main` SHA.
6. Verify `https://raddadband.com/version.json` reports the exact 40-character
   GitHub commit SHA from the workflow run.
7. Verify representative pages and assets, then confirm source-only paths such
   as `/package.json`, `/README.md`, `/tests/e2e/homepage.spec.js`,
   `/backup_restore_point/index.html`, and old repository ZIP files return 404.
8. Confirm GitHub Pages and the ChatGPT Sites URL still work independently.
9. After a second reviewed SHA exists, perform the rollback drill below.
10. Only after both owners accept the result, set
    `PROD_AUTO_DEPLOY_ENABLED=true`.

If truly unattended push-to-`main` deployment is desired, the Environment's
required-reviewer rule can be removed only after this checklist. Keeping it in
place is also valid; in that case each otherwise automatic deployment waits for
human approval.

## Rollback drill

The server retains approximately five versioned releases. To prove rollback
before enabling automatic deployment:

1. Record the SHA returned by the live `version.json`.
2. From Che's authenticated server session, invoke the helper's rollback mode
   for the preceding retained release:

   ```bash
   /usr/local/libexec/raddad-deploy rollback --sha <previous-40-character-sha> --config /etc/raddad-deploy.conf
   ```

3. Confirm the public `version.json` changes to that preceding SHA and the site
   responds normally.
4. Redeploy the intended `main` SHA and confirm it is live again.
5. Save the workflow run links and both SHA observations in the rollout record.

The helper also performs automatic rollback if its post-activation health check
does not return the expected SHA.

After each successful activation, the helper removes older inactive releases
until the configured `RADDAD_RETENTION_COUNT` (normally five) remains. It never
uses the repository clone as a release. Before lowering retention, confirm the
releases needed for the rollback window and retain an independent server
backup.

## Normal operation

After `PROD_AUTO_DEPLOY_ENABLED=true`, a push to `main` deploys only after its
tests, clean build, manifest verification, and protected Environment gate
succeed. Pull requests never run the production job and never receive
production secrets. Immediately before activation, the workflow confirms that
its tested SHA is still the tip of `origin/main`; an older, slower workflow run
cannot overwrite a newer release.

To make a controlled deployment while automatic mode is disabled, run the
workflow manually on `main` and choose `deploy`. Use `dry-run` whenever server
paths or permissions have changed.

### Identify the live commit

Read the public version marker without relying on a browser cache:

```bash
curl --fail --silent --show-error \
  "https://raddadband.com/version.json?v=<expected-40-character-sha>"
```

Its `commitSha` must exactly match the SHA shown by the successful GitHub
workflow run. Its timestamp identifies the build input. When validating a new
release, also check the page title, CSS, JavaScript, flyer images, custom video
thumbnails, calendar download, and internal links at both mobile and desktop
sizes.

## Disable and recover

For an emergency stop, set `PROD_AUTO_DEPLOY_ENABLED=false` first. This prevents
future push-triggered deployments; it does not change the active release.
Canceling an in-progress workflow does not substitute for rollback.

To recover, use the versioned release rollback procedure, verify the public
SHA and site health, and leave automatic mode disabled until the incident is
understood. Because activation is a symlink swap, rollback does not require a
new build.

The helper uses `/srv/raddad/.deploy.lock` to serialize server-side changes and
writes an `owner` file containing the PID, mode, SHA, and start time. If a host
crash leaves a stale lock, first confirm that the recorded process is no longer
running and that no deployment is active. Only then may Che remove that one
lock directory and rerun a dry run; never delete it merely because a workflow
appears slow.

## Key rotation and revocation

Rotate the dedicated Actions key without downtime:

1. Set `PROD_AUTO_DEPLOY_ENABLED=false`.
2. Generate a new key specifically for this deployment account.
3. Add the new public key alongside the old key on the server.
4. Replace `PROD_SSH_PRIVATE_KEY` in the GitHub `production` Environment.
5. Run the manual production `dry-run`.
6. Remove the old public key from the server and securely delete its private
   half.

If a key may be compromised, disable automatic deployment and remove that
public key from the server immediately, then replace the GitHub secret and
audit recent Environment deployments before restoring access. Rotate and
re-verify the pinned host key separately whenever the server host key changes.

## GitHub Actions outage

An Actions outage does not take the current site offline; the `current` symlink
continues serving the last healthy release. Prefer waiting for Actions rather
than bypassing the test-and-artifact chain.

If urgent recovery is necessary, Che can roll back locally to an already
retained release with the exact rollback command above. For an urgent new
release, use only a production artifact from a previously completed workflow,
not an arbitrary local build. Download that run's
`production-site-<sha>` artifact to a trusted workstation, extract it as
`production-site/`, and use the exact commit checkout to verify and package it:

```bash
SHA=THE_EXPECTED_40_CHARACTER_SHA
npm run verify:production -- \
  --artifact-dir production-site \
  --expected-sha "$SHA"
COPYFILE_DISABLE=1 tar -C production-site -czf "raddad-$SHA.tar.gz" .
```

Upload that tar through the already verified SSH connection to the private
incoming directory. From Che's authenticated server session, validate it
before activation:

```bash
SHA=THE_EXPECTED_40_CHARACTER_SHA
ARTIFACT="/srv/raddad/incoming/raddad-$SHA.tar.gz"
/usr/local/libexec/raddad-deploy check \
  --sha "$SHA" --artifact "$ARTIFACT" --config /etc/raddad-deploy.conf
/usr/local/libexec/raddad-deploy deploy \
  --sha "$SHA" --artifact "$ARTIFACT" --config /etc/raddad-deploy.conf
```

Record that manual intervention and reconcile the public SHA with `main` when
Actions returns. Never copy a whole repository clone into the web root as a
workaround.
