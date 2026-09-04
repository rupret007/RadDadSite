# Production deployment runbook

This runbook covers `raddadband.com`. GitHub Pages and the ChatGPT Sites
deployment remain independent and are not changed by this production path.

> **Current boundary (2026-08-30): not cut over.** The live server still uses
> the legacy repository-root publication path. Repository-only URLs are
> reachable and the three verified-release identity files are absent. The
> clean release layout below is the required target state, not a description of
> current production. A merge alone does not authorize the owner/Che cutover.

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
   run. The job can run only for `main`, only after all four repository gate
   variables described below are explicitly approved, uses the protected
   GitHub Environment named `production`, and serializes releases so two
   production activations cannot overlap.
5. The server validates the uploaded archive and SHA in a private staging
   directory, installs a versioned release, atomically changes the `current`
   symlink, verifies the exact public bytes of every file in that release, and
   requires representative repository, development, backup, and archive paths
   to return HTTP 404. A failed positive or negative check restores the verified
   previous release automatically, or removes an unverified first-release link
   when no safe fallback exists.

The checked-in workflow is inert for remote production work by default:
`PROD_REMOTE_ACTIONS_ENABLED` is absent or false, so even a manual dispatch
cannot start the SSH job. The first rollout is manual and must require a GitHub
Environment reviewer. Automatic deploys from `main` stay disabled until the
rollout and rollback drill have both succeeded.

## Repository access for Che

The public repository can be cloned without a GitHub sign-in:

```bash
git clone https://github.com/rupret007/RadDadSite.git
```

That clone is source material, not the production web root. If a clone is kept
on the server, place it in a dedicated private administrative directory outside
Apache's `DocumentRoot`, the entire release layout, and the deployment user's
home. The deployment workflow transfers only the verified `dist/client`
artifact; it does not publish the clone.

## Gate 1: fill in the production discovery record

The values below are intentionally not guessed in this repository. Che and Jeff
must fill in and approve a dated copy of this record before any server-changing
command in this guide. The completed record may be kept in an access-controlled
operations system instead of this public repository, but its location and
approvers must be recorded here.

| Required fact | Confirmed value |
| --- | --- |
| Discovery date and operator | `<FILL IN>` |
| Completed record location | `<FILL IN>` |
| SSH hostname and port | `<FILL IN>` |
| Dedicated non-root deployment user and primary group | `<FILL IN>` |
| Deployment user's home directory | `<FILL IN>` |
| `raddadband.com` virtual-host file | `<FILL IN>` |
| Exact current `raddadband.com` `DocumentRoot` | `<FILL IN>` |
| `lazypunksunite.com` virtual-host file | `<FILL IN>` |
| Exact current `lazypunksunite.com` `DocumentRoot` | `<FILL IN>` |
| Do the domains intentionally share a root? Why? | `<FILL IN: YES/NO and explanation>` |
| New release root, incoming root, and `current` path | `<FILL IN>` |
| Apache user/group and symlink policy | `<FILL IN>` |
| Required SELinux mode, file type, and labeling strategy | `<FILL IN>` |
| Files/paths that must remain server-managed | `<FILL IN or NONE>` |
| Exact narrow `sudo` commands, if any | `<FILL IN or NONE>` |
| Backup/snapshot identifier and time | `<FILL IN>` |
| Exact restore procedure and person authorized to run it | `<FILL IN>` |
| GitHub Environment/ruleset administrators | `<FILL IN>` |
| Workflow/helper code owners | `<FILL IN GitHub accounts/teams>` |
| First-rollout approvers | `<FILL IN; must include Jeff and Che>` |
| Actions SSH public-key SHA-256 fingerprint | `<FILL IN after key creation>` |
| Server SSH host-key type and SHA-256 fingerprint | `<FILL IN>` |

Do not put a password, private key, token, secret value, or sensitive backup
credential in the record, GitHub issues, pull requests, this repository, or
chat.

### Read-only discovery procedure

Run discovery from Che's authenticated administrative session. These commands
do not alter Apache or site files. Rocky Linux commonly uses `apachectl` or
`httpd`; use the installed equivalent and record which command worked.

```bash
set -Eeuo pipefail
date -u
hostnamectl
id
getenforce 2>/dev/null || true
command -v python3
command -v curl
command -v semanage 2>/dev/null || true
command -v restorecon 2>/dev/null || true
if command -v apachectl >/dev/null 2>&1; then
  APACHE_CTL="$(command -v apachectl)"
elif command -v httpd >/dev/null 2>&1; then
  APACHE_CTL="$(command -v httpd)"
else
  printf 'Neither apachectl nor httpd is installed\n' >&2
  exit 1
fi
printf 'Using Apache controller: %s\n' "$APACHE_CTL"
sudo "$APACHE_CTL" -t
sudo "$APACHE_CTL" -S
sudo "$APACHE_CTL" -t -D DUMP_VHOSTS
getent hosts raddadband.com
getent hosts lazypunksunite.com
curl --proto '=https' --fail --silent --show-error \
  --dump-header - --output /dev/null https://raddadband.com/
curl --proto '=https' --fail --silent --show-error \
  --dump-header - --output /dev/null https://lazypunksunite.com/
```

From the recorded controller's `-S` output, identify the two exact virtual-host
files and read only those relevant stanzas. Do not recursively print all of
`/etc` or any credential file into a log. After copying the confirmed, literal
paths into task-specific shell variables, validate them before inspecting:

```bash
set -Eeuo pipefail
RADDAD_VHOST='<FILL IN ABSOLUTE VHOST FILE>'
LAZYPUNKS_VHOST='<FILL IN ABSOLUTE VHOST FILE>'
RADDAD_LEGACY_ROOT='<FILL IN ABSOLUTE DOCUMENTROOT>'
LAZYPUNKS_ROOT='<FILL IN ABSOLUTE DOCUMENTROOT>'

for candidate in \
  "$RADDAD_VHOST" "$LAZYPUNKS_VHOST" \
  "$RADDAD_LEGACY_ROOT" "$LAZYPUNKS_ROOT"
do
  case "$candidate" in
    /*) ;;
    *) printf 'Not an absolute path: %s\n' "$candidate" >&2; exit 1 ;;
  esac
done
test "$RADDAD_LEGACY_ROOT" != /
test "$LAZYPUNKS_ROOT" != /

sudo sed -n '1,240p' "$RADDAD_VHOST"
sudo sed -n '1,240p' "$LAZYPUNKS_VHOST"
sudo readlink -e -- "$RADDAD_LEGACY_ROOT"
sudo readlink -e -- "$LAZYPUNKS_ROOT"
sudo stat -Lc '%d:%i %U:%G %a %n' \
  "$RADDAD_LEGACY_ROOT" "$LAZYPUNKS_ROOT"
sudo namei -l -- "$RADDAD_LEGACY_ROOT"
sudo namei -l -- "$LAZYPUNKS_ROOT"
sudo getfacl -p -- "$RADDAD_LEGACY_ROOT" "$LAZYPUNKS_ROOT"
sudo ls -ladZ -- "$RADDAD_LEGACY_ROOT" "$LAZYPUNKS_ROOT"
sudo find "$RADDAD_LEGACY_ROOT" -xdev -mindepth 1 -maxdepth 2 \
  -printf '%M %u:%g %p -> %l\n'
```

Matching resolved paths or matching device/inode values prove that the roots
are shared. Different values do not by themselves prove independence: also
inspect `Alias`, rewrite, include, and symlink directives in the two identified
vhosts. Inventory `.well-known`, `.htaccess`, uploads, verification files, and
other operator-managed content without printing file contents that may be
sensitive.

Before altering a virtual host or moving a file, create a restorable snapshot or
verified backup through the confirmed hosting control plane. Record its
identifier, exact restore steps, and restore operator. A backup is not verified
merely because a job reports success: confirm that its inventory includes the
legacy root and both vhost files and that the restore operator can access it.

### Mandatory stop conditions

Stop before `dry-run`, `prepare`, Apache cutover, deployment, or cleanup if any
of the following remains unknown or fails:

- either domain's effective virtual host or resolved `DocumentRoot`;
- whether the domains share content intentionally;
- ownership, ACLs, SELinux labels, or the deployment user's exact write scope;
- the server-managed content list and how each path will be mapped;
- the private incoming/release layout or Apache's `current` symlink policy;
- the exact narrowly permitted `sudo` commands;
- the backup identifier, restore steps, or restore operator;
- GitHub ruleset, Environment, code-owner, or first-rollout approval ownership;
- the pinned SSH host-key fingerprint or dedicated Actions key fingerprint;
- any difference between the discovery record and the server at rollout time.

Do not bypass a stop condition to meet a deployment deadline. Do not remove or
overwrite the legacy tree during discovery.

## Server layout

A representative layout is:

```text
/srv/raddad/
|-- incoming/                 # private uploads; not served by Apache
|-- .known-good               # helper-managed private health ledger
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

### Exact production allowlist and immutable releases

The production artifact contains only these paths:

```text
RadDad_Logo.jpg
SHA256SUMS
artifact-manifest.json
assets/rad-dad-friends-guitars-growlers-2026-1122.webp
assets/rad-dad-friends-guitars-growlers-2026-561.webp
assets/rad-dad-friends-guitars-growlers-2026-v2-1024.webp
assets/rad-dad-friends-guitars-growlers-2026-v2-512.webp
assets/rad-dad-friends-guitars-growlers-2026-v2-full.png
assets/rad-dad-friends-guitars-growlers-2026-full.png
assets/rad-dad-friends-guitars-growlers-2026.ics
assets/rad-dad-social-2026-v2.png
assets/rad-dad-social-2026.png
assets/rad-dad-tap-og.png
assets/story-of-us-cassette-render.webp
assets/story-of-us-cover.webp
assets/the-middle-jimmy-eat-world-thumbnail.webp
assets/wildflower-2026-poster-720.webp
assets/wildflower-she-green-day.webp
index.html
nfc/index.html
qr/index.html
qr/script.js
qr/styles.css
script.js
show-state.js
styles.css
tap/index.html
version.json
```

`artifact-manifest.json` and `SHA256SUMS` must account for every file exactly.
Anything else, including a dotfile, symlink, archive, upload, or repository
file, makes the release invalid.

The helper maintains a root-level `.known-good` ledger, owned by its effective
deployment user and mode `0600`, using atomic replacement. It records only SHAs
that passed the public health check. It is not web content and must never be
manually created, edited, copied into a release, or used as a substitute for
`raddad-deploy list`.

A directory under `releases/<sha>` is immutable after the helper installs it.
Never edit it, copy a file into it, create a symlink in it, relabel only part of
it inconsistently, or use it for uploads. Doing so invalidates its checksums and
causes a later deploy or rollback to fail closed.

If `.well-known`, uploads, analytics verification files, or another persistent
path is required, keep it in a server-owned directory outside `releases`,
`incoming`, and `.staging`. Map it with a narrowly scoped Apache `Alias` or
equivalent vhost rule. Do **not** link it inside `current` or a release. Fill in
literal confirmed paths before adapting this vhost template:

```apache
# TEMPLATE ONLY: use only for a path confirmed in the discovery record.
Alias "/.well-known/" "<FILL IN SHARED DIRECTORY>/.well-known/"
<Directory "<FILL IN SHARED DIRECTORY>/.well-known">
    Require all granted
    Options None
    AllowOverride None
</Directory>
```

Move any required, reviewed `.htaccess` behavior into the confirmed vhost
configuration. Do not copy `.htaccess` into a release. If a safe vhost or
`Alias` mapping for every required server-managed path is not reviewed and
tested, stop before cutover.

Before changing `DocumentRoot`, inspect both virtual hosts. Deleting, moving, or
replacing a shared root without a recorded decision could alter both sites.

### Install the server-owned helper

The checked-in [`scripts/deploy/server-deploy.sh`](../scripts/deploy/server-deploy.sh)
is infrastructure code, not a public site file. Install it from the exact
reviewed commit that passed the required `test` check, never from an unpinned
working copy. Run the following on the production server from Che's
authenticated administrative session. `SOURCE_PARENT` must be a pre-existing,
private administrative directory recorded during discovery, outside both
public roots, the release root, and the deployment user's home. This is not a
workstation command and does not rely on the caller's current directory:

```bash
set -Eeuo pipefail
REVIEWED_SHA='<FILL IN EXACT 40-CHARACTER REVIEWED MAIN SHA>'
SOURCE_PARENT='<FILL IN PRE-EXISTING PRIVATE SOURCE PARENT>'
DEPLOY_USER='<FILL IN DEDICATED DEPLOYMENT USER>'
RADDAD_DOCUMENT_ROOT='<FILL IN CONFIRMED RADDAD DOCUMENTROOT>'
LAZYPUNKS_DOCUMENT_ROOT='<FILL IN CONFIRMED LAZY PUNKS DOCUMENTROOT>'
RELEASE_ROOT='<FILL IN CONFIRMED RELEASE ROOT>'
DEPLOY_HOME='<FILL IN CONFIRMED DEPLOYMENT HOME>'
REPOSITORY_URL='https://github.com/rupret007/RadDadSite.git'
[[ "$REVIEWED_SHA" =~ ^[0-9a-f]{40}$ ]]

python3 - "$SOURCE_PARENT" "$DEPLOY_USER" \
  "$RADDAD_DOCUMENT_ROOT" "$LAZYPUNKS_DOCUMENT_ROOT" \
  "$RELEASE_ROOT" "$DEPLOY_HOME" <<'PY'
import os
import pwd
import stat
import sys

source, deploy_user, *excluded = sys.argv[1:]
deploy_uid = pwd.getpwnam(deploy_user).pw_uid
too_broad = {"/", "/etc", "/home", "/root", "/srv", "/tmp", "/usr", "/var"}
if not os.path.isabs(source) or os.path.normpath(source) != source:
    raise SystemExit("SOURCE_PARENT must be an absolute normalized path")
if source in too_broad:
    raise SystemExit("SOURCE_PARENT is too broad")
st = os.lstat(source)
if stat.S_ISLNK(st.st_mode) or not stat.S_ISDIR(st.st_mode):
    raise SystemExit("SOURCE_PARENT must be a real directory")
if os.path.realpath(source) != source:
    raise SystemExit("SOURCE_PARENT must be canonical")
if st.st_uid != os.getuid():
    raise SystemExit("SOURCE_PARENT must be owned by the authenticated operator")
if st.st_uid == deploy_uid:
    raise SystemExit("deployment user must not control SOURCE_PARENT")
if st.st_mode & 0o022:
    raise SystemExit("SOURCE_PARENT must not be group/world writable")
for path in excluded:
    if not os.path.isabs(path) or os.path.normpath(path) != path:
        raise SystemExit(f"excluded path is not absolute and normalized: {path}")
    if os.path.commonpath((source, path)) in (source, path):
        raise SystemExit(f"SOURCE_PARENT overlaps excluded path: {path}")
PY

SOURCE_DIR="$SOURCE_PARENT/RadDadSite-$REVIEWED_SHA"
test ! -e "$SOURCE_DIR"
test ! -L "$SOURCE_DIR"
git clone --no-checkout "$REPOSITORY_URL" "$SOURCE_DIR"
test "$(git -C "$SOURCE_DIR" remote get-url origin)" = "$REPOSITORY_URL"
git -C "$SOURCE_DIR" fetch --prune origin main
test "$(
  git -C "$SOURCE_DIR" rev-parse --verify "$REVIEWED_SHA^{commit}"
)" = "$REVIEWED_SHA"
git -C "$SOURCE_DIR" checkout --detach "$REVIEWED_SHA"
test "$(git -C "$SOURCE_DIR" rev-parse --verify HEAD^{commit})" = \
  "$REVIEWED_SHA"
test -z "$(git -C "$SOURCE_DIR" status --porcelain)"
git -C "$SOURCE_DIR" merge-base --is-ancestor \
  "$REVIEWED_SHA" origin/main

LOCAL_HELPER_SHA="$(
  sha256sum "$SOURCE_DIR/scripts/deploy/server-deploy.sh" | cut -d ' ' -f 1
)"
sudo python3 - /usr/local/libexec/raddad-deploy \
  /etc/raddad-deploy.conf <<'PY'
import os
import stat
import sys

for destination in sys.argv[1:]:
    parent = os.path.dirname(destination)
    parent_stat = os.lstat(parent)
    if stat.S_ISLNK(parent_stat.st_mode) or not stat.S_ISDIR(parent_stat.st_mode):
        raise SystemExit(f"unsafe destination parent: {parent}")
    if os.path.realpath(parent) != parent:
        raise SystemExit(f"non-canonical destination parent: {parent}")
    if parent_stat.st_uid != 0 or parent_stat.st_mode & 0o022:
        raise SystemExit(f"destination parent is not root-controlled: {parent}")
    try:
        target_stat = os.lstat(destination)
    except FileNotFoundError:
        continue
    if stat.S_ISLNK(target_stat.st_mode) or not stat.S_ISREG(target_stat.st_mode):
        raise SystemExit(f"destination is not a real regular file: {destination}")
    if target_stat.st_uid != 0 or target_stat.st_mode & 0o022:
        raise SystemExit(f"destination is not root-controlled: {destination}")
PY
sudo install -o root -g root -m 0755 \
  "$SOURCE_DIR/scripts/deploy/server-deploy.sh" \
  /usr/local/libexec/raddad-deploy
if sudo test ! -e /etc/raddad-deploy.conf; then
  sudo test ! -L /etc/raddad-deploy.conf
  sudo install -o root -g root -m 0644 \
    "$SOURCE_DIR/docs/raddad-deploy.conf.example" \
    /etc/raddad-deploy.conf
else
  printf '%s\n' \
    'Existing config preserved; reconcile it with the reviewed example.'
fi
REMOTE_HELPER_SHA="$(
  sudo sha256sum /usr/local/libexec/raddad-deploy | cut -d ' ' -f 1
)"
test "$LOCAL_HELPER_SHA" = "$REMOTE_HELPER_SHA"
```

Edit `/etc/raddad-deploy.conf` only after confirming the real release path and
health-check origin, then confirm it remains a root-owned, non-symlink regular
file:

```bash
set -Eeuo pipefail
sudo python3 - /etc/raddad-deploy.conf <<'PY'
import os
import stat
import sys

path = sys.argv[1]
st = os.lstat(path)
if stat.S_ISLNK(st.st_mode) or not stat.S_ISREG(st.st_mode):
    raise SystemExit("deployment config must be a real regular file")
if st.st_uid != 0 or st.st_mode & 0o022:
    raise SystemExit("deployment config must be root-controlled")
if os.path.realpath(path) != path:
    raise SystemExit("deployment config path must be canonical")
PY
sudoedit /etc/raddad-deploy.conf
sudo python3 - /etc/raddad-deploy.conf <<'PY'
import os
import stat
import sys

path = sys.argv[1]
fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
try:
    st = os.fstat(fd)
    if not stat.S_ISREG(st.st_mode):
        raise SystemExit("deployment config ceased to be a regular file")
    os.fchown(fd, 0, 0)
    os.fchmod(fd, 0o644)
finally:
    os.close(fd)
PY
sudo stat -Lc '%U:%G %a %n' /etc/raddad-deploy.conf
```

The example contains no credentials. Record the reviewed commit and helper hash
in the discovery record. The workflow verifies that the installed helper's
SHA-256 matches the helper in its exact tested commit before upload or
activation. If the helper changes, review and reinstall it before the next
production dry run.

The helper requires Bash, Python 3, and curl from the server's trusted package
repositories. Confirm them before rollout:

```bash
set -Eeuo pipefail
command -v bash python3 curl
bash --version | head -n 1
python3 --version
curl --version | head -n 1
```

### Create and verify the deployment account

Use the values approved in the discovery record. The following is a template,
not permission to replace an existing account. If `getent` finds an account,
inspect it and reconcile it instead of running `useradd`.

```bash
set -Eeuo pipefail
DEPLOY_USER='<FILL IN DEDICATED USER>'
DEPLOY_GROUP='<FILL IN DEDICATED PRIMARY GROUP>'
DEPLOY_HOME='<FILL IN ABSOLUTE PRIVATE HOME>'

[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]]
[[ "$DEPLOY_GROUP" =~ ^[a-z_][a-z0-9_-]*$ ]]
case "$DEPLOY_HOME" in
  /*) ;;
  *) printf 'Deployment home must be absolute\n' >&2; exit 1 ;;
esac
case "$DEPLOY_HOME" in
  /|/home|/root|/srv|/var|/usr|/tmp)
    printf 'Deployment home is too broad\n' >&2; exit 1 ;;
esac
test "$(python3 -c 'import os,sys; print(os.path.normpath(sys.argv[1]))' \
  "$DEPLOY_HOME")" = "$DEPLOY_HOME"
if getent passwd "$DEPLOY_USER" >/dev/null; then
  ACCOUNT_EXISTS=1
else
  ACCOUNT_EXISTS=0
fi
DEPLOY_PARENT="$(dirname "$DEPLOY_HOME")"
sudo python3 - "$DEPLOY_PARENT" "$DEPLOY_HOME" "$ACCOUNT_EXISTS" <<'PY'
import os
import stat
import sys

parent, home, account_exists_raw = sys.argv[1:]
account_exists = account_exists_raw == "1"
parent_st = os.lstat(parent)
if stat.S_ISLNK(parent_st.st_mode) or not stat.S_ISDIR(parent_st.st_mode):
    raise SystemExit("deployment-home parent must be a real directory")
if os.path.realpath(parent) != parent:
    raise SystemExit("deployment-home parent must be canonical")
if parent_st.st_uid != 0 or parent_st.st_mode & 0o022:
    raise SystemExit("deployment-home parent must be root-controlled")
if os.path.lexists(home):
    if not account_exists:
        raise SystemExit("deployment home exists but deployment user does not")
    home_st = os.lstat(home)
    if stat.S_ISLNK(home_st.st_mode) or not stat.S_ISDIR(home_st.st_mode):
        raise SystemExit("existing deployment home must be a real directory")
    if os.path.realpath(home) != home:
        raise SystemExit("existing deployment home must be canonical")
elif account_exists:
    raise SystemExit("deployment user exists but its confirmed home does not")
PY
if ((ACCOUNT_EXISTS)); then
  getent group "$DEPLOY_GROUP" >/dev/null
  printf 'Existing account found; validating without changing it\n'
else
  getent group "$DEPLOY_GROUP" >/dev/null ||
    sudo groupadd --system "$DEPLOY_GROUP"
  sudo useradd --create-home --home-dir "$DEPLOY_HOME" \
    --gid "$DEPLOY_GROUP" --shell /bin/bash "$DEPLOY_USER"
  sudo passwd -l "$DEPLOY_USER"
fi
getent passwd "$DEPLOY_USER"
id "$DEPLOY_USER"
test "$(getent passwd "$DEPLOY_USER" | cut -d: -f6)" = "$DEPLOY_HOME"
test "$(id -gn "$DEPLOY_USER")" = "$DEPLOY_GROUP"
sudo python3 - "$DEPLOY_HOME" "$DEPLOY_USER" <<'PY'
import os
import pwd
import stat
import sys

home, user = sys.argv[1:]
st = os.lstat(home)
if stat.S_ISLNK(st.st_mode) or not stat.S_ISDIR(st.st_mode):
    raise SystemExit("deployment home must be a real directory")
if os.path.realpath(home) != home:
    raise SystemExit("deployment home must be canonical")
if st.st_uid != pwd.getpwnam(user).pw_uid:
    raise SystemExit("deployment home has the wrong owner")
if st.st_mode & 0o022:
    raise SystemExit("deployment home must not be group/world writable")
PY
```

Do not give this account a password, broad `sudo`, Apache/TLS configuration
access, or write access to another vhost. The Actions key installation and
fingerprint procedure is in [Least-privilege SSH key](#least-privilege-ssh-key).

After substituting the confirmed account, Apache read-only group, and release
root, create the private directories once. This first-install block requires
the entire release root, including a dangling symlink with that name, to be
absent. If it already exists, stop and reconcile it with the helper's `check`
mode instead of rerunning this block. The helper intentionally refuses to
create or guess these directories:

```bash
set -Eeuo pipefail
DEPLOY_USER='<FILL IN DEDICATED USER>'
DEPLOY_GROUP='<FILL IN DEDICATED PRIMARY GROUP>'
APACHE_GROUP='<FILL IN CONFIRMED APACHE GROUP>'
RELEASE_ROOT='<FILL IN CONFIRMED ABSOLUTE RELEASE ROOT>'

[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]]
[[ "$DEPLOY_GROUP" =~ ^[a-z_][a-z0-9_-]*$ ]]
[[ "$APACHE_GROUP" =~ ^[a-z_][a-z0-9_-]*$ ]]
getent passwd "$DEPLOY_USER" >/dev/null
getent group "$DEPLOY_GROUP" >/dev/null
getent group "$APACHE_GROUP" >/dev/null
test "$(id -gn "$DEPLOY_USER")" = "$DEPLOY_GROUP"
case "$RELEASE_ROOT" in
  /*) ;;
  *) printf 'Release root must be absolute\n' >&2; exit 1 ;;
esac
[[ "$RELEASE_ROOT" =~ ^/[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+){1,}$ ]]
case "$RELEASE_ROOT" in
  /|/etc|/home|/root|/srv|/tmp|/usr|/var)
    printf 'Release root is too broad\n' >&2; exit 1 ;;
esac

RELEASE_PARENT="$(dirname "$RELEASE_ROOT")"
sudo python3 - "$RELEASE_PARENT" "$RELEASE_ROOT" <<'PY'
import os
import stat
import sys

parent, root = sys.argv[1:]
parent_st = os.lstat(parent)
if stat.S_ISLNK(parent_st.st_mode) or not stat.S_ISDIR(parent_st.st_mode):
    raise SystemExit("release parent must be a real directory")
if os.path.realpath(parent) != parent:
    raise SystemExit("release parent must be canonical")
if parent_st.st_uid != 0 or parent_st.st_mode & 0o022:
    raise SystemExit("release parent must be root-controlled")
if os.path.lexists(root):
    raise SystemExit("release root already exists, including as a symlink")
PY
sudo install -d -o root -g root -m 0755 "$RELEASE_ROOT"
sudo install -d -o root -g root -m 0755 \
  "$RELEASE_ROOT/releases" \
  "$RELEASE_ROOT/incoming" \
  "$RELEASE_ROOT/.staging"
sudo chown "$DEPLOY_USER:$APACHE_GROUP" "$RELEASE_ROOT/releases"
sudo chmod 0750 "$RELEASE_ROOT/releases"
sudo chown "$DEPLOY_USER:$DEPLOY_GROUP" \
  "$RELEASE_ROOT/incoming" "$RELEASE_ROOT/.staging"
sudo chmod 0700 "$RELEASE_ROOT/incoming" "$RELEASE_ROOT/.staging"
sudo chown "$DEPLOY_USER:$APACHE_GROUP" "$RELEASE_ROOT"
sudo chmod 0750 "$RELEASE_ROOT"
sudo -u "$DEPLOY_USER" test -w "$RELEASE_ROOT"
sudo -u "$DEPLOY_USER" test -w "$RELEASE_ROOT/releases"
sudo -u "$DEPLOY_USER" test -w "$RELEASE_ROOT/incoming"
sudo -u "$DEPLOY_USER" test -w "$RELEASE_ROOT/.staging"
sudo stat -Lc '%U:%G %a %n' \
  "$RELEASE_ROOT" "$RELEASE_ROOT/releases" \
  "$RELEASE_ROOT/incoming" "$RELEASE_ROOT/.staging"
```

Confirm separately that the account cannot write the identified Apache config,
TLS paths, legacy root, Lazy Punks root, or any other release root. Record those
`test ! -w` results. Keep the config and installed helper root-owned. No
directory in this layout is beneath the old public `DocumentRoot`;
`current` is the new selected `DocumentRoot`.

### SELinux is a separate deployment gate

Never disable SELinux. On an enforcing host, the discovery record must identify
the confirmed Apache read-only content type and one of these reviewed
strategies:

1. Apply one persistent content-type rule to both `releases` and `.staging` so
   newly extracted files inherit the same Apache-readable type before the
   atomic rename. Unix mode `0700` still blocks Apache from traversing
   `.staging`.
2. Use a reviewed, narrowly privileged per-release labeling hook that applies
   `restorecon` to the exact `releases/<40-character-sha>` after installation
   and before activation.

The current helper must not be used for unattended activation unless the chosen
strategy labels every new release before Apache can serve it. Do not guess that
the common `httpd_sys_content_t` is correct. Fill in the confirmed type and
literal root, then have Che adapt and review this template. This template
intentionally permits only slash-separated alphanumeric, underscore, and
hyphen path components. That constraint makes the path safe to embed in an
SELinux regular expression; if the confirmed root contains any other
character, stop and have an SELinux administrator generate and review the
escaped expression instead of weakening the check:

```bash
set -Eeuo pipefail
RELEASE_ROOT='<FILL IN CONFIRMED ABSOLUTE RELEASE ROOT>'
APACHE_CONTENT_TYPE='<FILL IN CONFIRMED SELINUX TYPE>'
[[ "$RELEASE_ROOT" =~ ^/[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+){1,}$ ]]
case "$RELEASE_ROOT" in
  /|/etc|/home|/root|/srv|/tmp|/usr|/var)
    printf 'Release root is too broad\n' >&2; exit 1 ;;
esac
[[ "$APACHE_CONTENT_TYPE" =~ ^[a-z0-9_]+_t$ ]]
sudo python3 - "$RELEASE_ROOT" <<'PY'
import os
import stat
import sys

root = sys.argv[1]
if os.path.realpath(root) != root:
    raise SystemExit("release root must be canonical")
root_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
try:
    for name in ("releases", ".staging"):
        details = os.stat(name, dir_fd=root_fd, follow_symlinks=False)
        if stat.S_ISLNK(details.st_mode) or not stat.S_ISDIR(details.st_mode):
            raise SystemExit(f"{name} must be a real directory")
        if details.st_mode & 0o022:
            raise SystemExit(f"{name} must not be group/world writable")
finally:
    os.close(root_fd)
PY

RELEASES_FCONTEXT="${RELEASE_ROOT}/releases(/.*)?"
STAGING_FCONTEXT="${RELEASE_ROOT}/\\.staging(/.*)?"
FCONTEXT_TABLE="$(sudo semanage fcontext -l)"
RULE_STATE="$(
  python3 -c '
import sys

release_rule, staging_rule, expected_type = sys.argv[1:]
lines = sys.stdin.read().splitlines()
states = []
for rule in (release_rule, staging_rule):
    matches = [line for line in lines if line.split() and line.split()[0] == rule]
    if len(matches) > 1:
        raise SystemExit(f"duplicate SELinux fcontext rules for {rule}")
    if not matches:
        states.append("absent")
        continue
    if f":{expected_type}:" not in matches[0]:
        raise SystemExit(f"SELinux fcontext rule has an unexpected type: {rule}")
    states.append("present")
if states[0] != states[1]:
    raise SystemExit("only one SELinux fcontext rule exists; reconcile first")
print(states[0])
  ' "$RELEASES_FCONTEXT" "$STAGING_FCONTEXT" \
    "$APACHE_CONTENT_TYPE" <<<"$FCONTEXT_TABLE"
)"
case "$RULE_STATE" in
  absent)
    sudo semanage fcontext -a -t "$APACHE_CONTENT_TYPE" \
      "$RELEASES_FCONTEXT"
    sudo semanage fcontext -a -t "$APACHE_CONTENT_TYPE" \
      "$STAGING_FCONTEXT"
    ;;
  present)
    printf 'Both exact SELinux fcontext rules already exist with the approved type\n'
    ;;
  *)
    printf 'Unexpected SELinux rule state\n' >&2
    exit 1
    ;;
esac
sudo restorecon -RFv \
  "$RELEASE_ROOT/releases" "$RELEASE_ROOT/.staging"
sudo matchpathcon "$RELEASE_ROOT/releases"
sudo matchpathcon "$RELEASE_ROOT/.staging"
sudo ls -ladZ "$RELEASE_ROOT/releases" "$RELEASE_ROOT/.staging"
```

The block stops before adding either rule if only one exists, a duplicate
exists, or either existing rule has another type. Reconcile that state with an
SELinux administrator before rerunning it. Prove inheritance with `prepare`,
inspect the prepared release recursively with `ls -lZR`, verify Apache can read
it but cannot traverse `.staging`, and record the evidence. If inheritance
differs from the approved type or requires a per-release hook that is not
implemented, stop; do not enable automatic deployment.

## GitHub configuration

### Protect `main` and deployment infrastructure

Before adding production secrets, create or confirm a repository ruleset for
`main` with all of these controls:

- all changes to `main` arrive through a pull request;
- the required status check is the workflow job named `test`, and the branch
  must be up to date before merge;
- required review conversations are resolved;
- force pushes and branch deletion are blocked;
- bypass is disabled, or its smallest unavoidable actor list and reason are
  recorded in the discovery record;
- changes to `.github/workflows/test.yml`, `scripts/deploy/`,
  `scripts/lib/production-artifact.mjs`, `scripts/build-sites.mjs`,
  `scripts/verify-production-artifact.mjs`, and these deployment documents
  require review by a designated deployment code owner;
- the person who authored deployment infrastructure cannot be its only
  approving reviewer.

Record the ruleset URL or identifier, code-owner accounts/teams, and a screenshot
or exported ruleset in the controlled rollout record. If path ownership is
implemented with `CODEOWNERS`, verify the file is on the protected branch and
that code-owner review is required. Stop if administrators or automation can
silently bypass these controls.

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
| `PROD_REMOTE_ACTIONS_ENABLED` | `false` | Master kill switch; absent/false keeps every SSH action disabled |
| `PROD_DISCOVERY_RECORD_APPROVED` | `false` | Attests that Jeff and Che approved the completed dated discovery record |
| `PROD_GITHUB_GATES_APPROVED` | `false` | Attests that the `main` ruleset, code-owner review, protected Environment reviewer, and Prevent self-review gates were verified |
| `PROD_VHOST_INTENT` | `<unset>` | Must be exactly `separate-roots` or `shared-root-approved` after both `raddadband.com` and `lazypunksunite.com` vhosts are inspected |
| `PROD_AUTO_DEPLOY_ENABLED` | `false` | Enables push-to-`main` deploys only after validation |

Required `production` Environment variables:

| Variable | Example | Purpose |
| --- | --- | --- |
| `PROD_HOST` | `raddadband.com` | SSH hostname |
| `PROD_PORT` | `22` | SSH port |
| `PROD_USER` | `raddad-deploy` | Dedicated deployment account |
| `PROD_STAGE_ROOT` | `/srv/raddad/incoming` | Private remote upload directory |

Configure all five gate/dispatch values as repository variables because GitHub
must evaluate them before starting the Environment-protected job. Never make
them secrets. An absent or unexpected value fails closed. In particular,
`PROD_REMOTE_ACTIONS_ENABLED` must remain `false` until the discovery record,
shared-vhost decision, branch rules, code-owner requirement, and protected
Environment reviewer configuration are all approved. Set
`PROD_VHOST_INTENT=separate-roots` only after proving the domains are isolated;
use `shared-root-approved` only when Jeff and Che explicitly approve continued
shared behavior and its impact. `PROD_SITE_URL` is repository-scoped because
GitHub resolves the deployment URL before the runner loads Environment-level
variables. The SSH connection values remain scoped to the `production`
Environment.

The release root is deliberately **not** supplied by the workflow. The
normal workflow always invokes the fixed, root-owned
`/etc/raddad-deploy.conf`, whose values override any pre-set `RADDAD_*`
environment values. The helper retains an explicit `--config` option for its
test harness and controlled operator use; never substitute another config in a
production command. Filesystem ownership is the final containment boundary:
the deployment account must be unable to write any other site or broad server
path even if it invokes the helper manually. Before rollout, verify the fixed
workflow command, the production config's root ownership, environment-override
rejection, and the account's negative write tests. Stop if any of those checks
fail.

### Pin the SSH host key

Che should obtain the server's current public host key from the server console
or hosting control plane, not from the deployment network alone. Save the
public, non-secret key in a temporary file and calculate its fingerprint:

```bash
set -Eeuo pipefail
HOST_PUBLIC_KEY_FILE='<FILL IN TRUSTED PUBLIC HOST-KEY FILE>'
ssh-keygen -lf "$HOST_PUBLIC_KEY_FILE" -E sha256
```

Compare the key type and SHA-256 fingerprint with a second out-of-band source,
then record them. Construct the complete `known_hosts` line using the exact
confirmed SSH hostname; for a non-default port, use `[hostname]:port`. Verify
the line locally without exposing a private key:

```bash
set -Eeuo pipefail
KNOWN_HOSTS_FILE='<FILL IN TEMPORARY KNOWN_HOSTS FILE>'
PROD_HOST='<FILL IN CONFIRMED SSH HOST>'
PROD_PORT='<FILL IN CONFIRMED SSH PORT>'
[[ "$PROD_HOST" =~ ^[A-Za-z0-9.-]+$ ]]
[[ "$PROD_PORT" =~ ^[0-9]{1,5}$ ]]
((PROD_PORT >= 1 && PROD_PORT <= 65535))
test -f "$KNOWN_HOSTS_FILE"
test ! -L "$KNOWN_HOSTS_FILE"
chmod 0600 "$KNOWN_HOSTS_FILE"
if ((PROD_PORT == 22)); then
  EXPECTED_HOST_FIELD="$PROD_HOST"
  ALTERNATE_HOST_FIELD="[$PROD_HOST]:$PROD_PORT"
else
  EXPECTED_HOST_FIELD="[$PROD_HOST]:$PROD_PORT"
  ALTERNATE_HOST_FIELD="$PROD_HOST"
fi
ssh-keygen -F "$EXPECTED_HOST_FIELD" -f "$KNOWN_HOSTS_FILE"
if ssh-keygen -F "$ALTERNATE_HOST_FIELD" \
  -f "$KNOWN_HOSTS_FILE" >/dev/null
then
  printf 'Unexpected duplicate hostname/port form in known_hosts\n' >&2
  exit 1
fi
```

The expected lookup must match, and the alternate hostname/port form must not.
Store that complete line in the `PROD_SSH_KNOWN_HOSTS` Environment secret.

The workflow deliberately uses `StrictHostKeyChecking=yes`. Do not replace the
pinned value with `ssh-keyscan` inside the workflow and do not disable host-key
checking. `ssh-keyscan` output observed over the network is not an identity
proof.

### Least-privilege SSH key

Create a new Ed25519 key used only by this GitHub Environment on a trusted
administrative workstation. The private file exists only long enough to add it
directly to `PROD_SSH_PRIVATE_KEY`; never paste it into chat, a shell trace, an
issue, or a file in this clone.

```bash
set -Eeuo pipefail
umask 077
KEY_DIR="$(mktemp -d)"
KEY_FILE="$KEY_DIR/raddad-actions-$(date -u +%Y%m%dT%H%M%SZ)"
ssh-keygen -t ed25519 -a 64 \
  -C "github-actions:raddad-production:$(date -u +%Y-%m-%d)" \
  -N '' -f "$KEY_FILE"
ssh-keygen -lf "$KEY_FILE.pub" -E sha256
```

Record the SHA-256 public-key fingerprint. Copy only the `.pub` file to Che
through the approved administrative channel. On the server, inspect the exact
public key and append it without replacing existing operator keys:

```bash
set -Eeuo pipefail
DEPLOY_USER='<FILL IN DEDICATED USER>'
DEPLOY_GROUP='<FILL IN DEDICATED PRIMARY GROUP>'
DEPLOY_HOME='<FILL IN CONFIRMED HOME>'
NEW_PUBLIC_KEY='<FILL IN ABSOLUTE PATH TO REVIEWED .pub FILE>'
AUTHORIZED_KEYS="$DEPLOY_HOME/.ssh/authorized_keys"

[[ "$DEPLOY_HOME" == /* ]]
[[ "$NEW_PUBLIC_KEY" == /* ]]
test -f "$NEW_PUBLIC_KEY"
test ! -L "$NEW_PUBLIC_KEY"
test "$(readlink -e -- "$NEW_PUBLIC_KEY")" = "$NEW_PUBLIC_KEY"
test "$(wc -l < "$NEW_PUBLIC_KEY" | tr -d ' ')" = 1
grep -Eq '^ssh-ed25519 [A-Za-z0-9+/]+={0,3}( .*)?$' "$NEW_PUBLIC_KEY"
AUTHORIZED_LINE="restrict $(cat "$NEW_PUBLIC_KEY")"
sudo python3 - \
  "$DEPLOY_HOME" "$DEPLOY_USER" "$DEPLOY_GROUP" "$AUTHORIZED_LINE" <<'PY'
import fcntl
import grp
import os
import pwd
import stat
import sys

home, user, group, authorized_line = sys.argv[1:]
account = pwd.getpwnam(user)
group_entry = grp.getgrnam(group)
if account.pw_gid != group_entry.gr_gid:
    raise SystemExit("confirmed group is not the deployment user's primary group")
if account.pw_dir != home:
    raise SystemExit("confirmed home differs from the account database")
if not os.path.isabs(home) or os.path.normpath(home) != home:
    raise SystemExit("deployment home must be absolute and normalized")
if home in {"/", "/home", "/root", "/srv", "/tmp", "/usr", "/var"}:
    raise SystemExit("deployment home is too broad")
if os.path.realpath(home) != home:
    raise SystemExit("deployment home must be canonical")
if "\n" in authorized_line or "\r" in authorized_line:
    raise SystemExit("authorized key must be exactly one line")

flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
home_fd = os.open(home, flags)
try:
    home_st = os.fstat(home_fd)
    if home_st.st_uid != account.pw_uid:
        raise SystemExit("deployment home has the wrong owner")
    if home_st.st_mode & 0o022:
        raise SystemExit("deployment home is group/world writable")

    try:
        os.mkdir(".ssh", mode=0o700, dir_fd=home_fd)
        ssh_fd = os.open(".ssh", flags, dir_fd=home_fd)
        os.fchown(ssh_fd, account.pw_uid, group_entry.gr_gid)
        os.fchmod(ssh_fd, 0o700)
    except FileExistsError:
        ssh_fd = os.open(".ssh", flags, dir_fd=home_fd)
        ssh_st = os.fstat(ssh_fd)
        if ssh_st.st_uid != account.pw_uid:
            raise SystemExit(".ssh has the wrong owner")
        if stat.S_IMODE(ssh_st.st_mode) != 0o700:
            raise SystemExit("existing .ssh mode must be exactly 0700")

    try:
        key_flags = os.O_RDWR | os.O_APPEND | os.O_NOFOLLOW
        created = False
        try:
            key_fd = os.open("authorized_keys", key_flags, dir_fd=ssh_fd)
        except FileNotFoundError:
            key_fd = os.open(
                "authorized_keys",
                key_flags | os.O_CREAT | os.O_EXCL,
                0o600,
                dir_fd=ssh_fd,
            )
            created = True

        try:
            fcntl.flock(key_fd, fcntl.LOCK_EX)
            key_st = os.fstat(key_fd)
            if not stat.S_ISREG(key_st.st_mode) or key_st.st_nlink != 1:
                raise SystemExit("authorized_keys must be an unlinked regular file")
            if created:
                os.fchown(key_fd, account.pw_uid, group_entry.gr_gid)
                os.fchmod(key_fd, 0o600)
                key_st = os.fstat(key_fd)
            elif key_st.st_uid != account.pw_uid:
                raise SystemExit("authorized_keys has the wrong owner")
            elif stat.S_IMODE(key_st.st_mode) != 0o600:
                raise SystemExit("existing authorized_keys mode must be exactly 0600")

            os.lseek(key_fd, 0, os.SEEK_SET)
            existing = b""
            while True:
                chunk = os.read(key_fd, 65536)
                if not chunk:
                    break
                existing += chunk
                if len(existing) > 1024 * 1024:
                    raise SystemExit("authorized_keys exceeds the 1 MiB safety limit")
            encoded = authorized_line.encode("utf-8")
            if encoded not in existing.splitlines():
                prefix = b"" if not existing or existing.endswith(b"\n") else b"\n"
                os.write(key_fd, prefix + encoded + b"\n")
                os.fsync(key_fd)

            path_st = os.stat(
                "authorized_keys", dir_fd=ssh_fd, follow_symlinks=False
            )
            final_st = os.fstat(key_fd)
            if (path_st.st_dev, path_st.st_ino) != (
                final_st.st_dev,
                final_st.st_ino,
            ):
                raise SystemExit("authorized_keys changed during update")
        finally:
            os.close(key_fd)
    finally:
        os.close(ssh_fd)
finally:
    os.close(home_fd)
PY
sudo -H -u "$DEPLOY_USER" \
  ssh-keygen -lf "$AUTHORIZED_KEYS" -E sha256
```

The empty passphrase is intentional because the non-interactive workflow cannot
unlock an encrypted key; Environment protection and the restricted account are
the compensating controls. Use the `restrict` authorized-key option only after
confirming the host's
OpenSSH version supports it. It blocks forwarding and PTY features while still
allowing the workflow's required exec and SFTP/SCP operations. If unsupported,
use the individually reviewed `no-agent-forwarding`, `no-port-forwarding`,
`no-pty`, `no-user-rc`, and `no-X11-forwarding` options instead. Do not add a
forced command unless a reviewed dispatcher supports the exact workflow
operations.

Add the private file directly to the GitHub `production` Environment secret,
run a manual `dry-run`, then remove the temporary private-key file from the
workstation according to the organization's secure-media policy. At minimum,
validate and remove only the task-specific temporary target:

```bash
set -Eeuo pipefail
KEY_DIR='<FILL IN EXACT TEMPORARY DIRECTORY FROM KEY GENERATION>'
KEY_FILE='<FILL IN EXACT PRIVATE-KEY PATH FROM KEY GENERATION>'
[[ "$KEY_DIR" == /* ]]
[[ "$KEY_FILE" == /* ]]
test -d "$KEY_DIR"
test ! -L "$KEY_DIR"
test -f "$KEY_FILE"
test ! -L "$KEY_FILE"
test "$(dirname "$KEY_FILE")" = "$KEY_DIR"
[[ "$(basename "$KEY_FILE")" =~ ^raddad-actions-[0-9]{8}T[0-9]{6}Z$ ]]
test "$(cd -P -- "$KEY_DIR" && pwd -P)" = "$KEY_DIR"
rm -f -- "$KEY_FILE"
test ! -e "$KEY_FILE"
test ! -L "$KEY_FILE"
```

Retain the public key and fingerprint record; do not retain another private
copy.

Give the account no broad `sudo` access and grant filesystem access only to its
private incoming directory and the Rad Dad release layout.

The current workflow uses SCP/SFTP plus narrowly constructed `test`,
`sha256sum`, cleanup, and helper commands over SSH. A helper-only forced command
would therefore break it. Add a forced command only if Che first installs and
tests a reviewed dispatcher that explicitly supports those exact operations;
otherwise rely on the dedicated account, restrictive ownership, and no `sudo`
as the least-privilege boundary.

The GitHub secret value must never be committed, downloaded into the repository,
or sent in chat.

## Bootstrap the clean release layout

The current legacy web root is not a valid rollback release: it publicly
contains repository files and has no verified `version.json`. Do not copy that
tree into `releases/` or use it as the rollback target.

The first Apache cutover needs one clean prepared release before the public
virtual host can health-check through `current`:

1. Keep Apache pointed at the existing web root. Reconfirm the backup identifier
   and that the restore operator is present.
2. Record the exact reviewed `main` SHA and successful required `test` check.
   Run the protected workflow on that SHA with
   `production_action=dry-run`.
3. Run it again with `production_action=prepare`. The helper validates and
   installs `releases/<sha>` but deliberately does not change `current`.
4. Run the helper's read-only release inventory from Che's session:

   ```bash
   set -Eeuo pipefail
   DEPLOY_USER='<FILL IN DEDICATED USER>'
   sudo -H -u "$DEPLOY_USER" \
     /usr/local/libexec/raddad-deploy list \
     --config /etc/raddad-deploy.conf
   ```

   The prepared SHA should be reported as installed but not yet healthy, and
   there should be no unexpected or broken release. Stop on any discrepancy.
5. Complete and record the approved SELinux proof for the prepared release.
   Apache must be able to traverse/read the release, while it must be unable to
   traverse `incoming` or `.staging`.
6. With Che watching the virtual host and no active deployment lock, create
   `current` only if neither a file nor a dangling symlink already exists:

   ```bash
   set -Eeuo pipefail
   RELEASE_ROOT='<FILL IN CONFIRMED RELEASE ROOT>'
   DEPLOY_USER='<FILL IN DEDICATED USER>'
   PREPARED_SHA='<FILL IN PREPARED 40-CHARACTER SHA>'
   [[ "$PREPARED_SHA" =~ ^[0-9a-f]{40}$ ]]
   sudo -H -u "$DEPLOY_USER" \
     python3 - "$RELEASE_ROOT" "$PREPARED_SHA" <<'PY'
   import datetime
   import json
   import os
   import stat
   import sys

   root, sha = sys.argv[1:]
   if not os.path.isabs(root) or os.path.normpath(root) != root:
       raise SystemExit("release root must be absolute and normalized")
   if root in {"/", "/etc", "/home", "/root", "/srv", "/tmp", "/usr", "/var"}:
       raise SystemExit("release root is too broad")
   if os.path.realpath(root) != root:
       raise SystemExit("release root must be canonical")

   root_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
   lock_created = False
   lock_fd = None
   owner_created = False
   try:
       root_st = os.fstat(root_fd)
       if root_st.st_uid != os.geteuid() or root_st.st_mode & 0o022:
           raise SystemExit("release root ownership or mode is unsafe")

       try:
           os.mkdir(".deploy.lock", mode=0o700, dir_fd=root_fd)
       except FileExistsError as error:
           raise SystemExit("a deployment lock already exists") from error
       lock_created = True
       lock_fd = os.open(
           ".deploy.lock",
           os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
           dir_fd=root_fd,
       )
       lock_st = os.fstat(lock_fd)
       if lock_st.st_uid != os.geteuid():
           raise SystemExit("new deployment lock has the wrong owner")
       os.fchmod(lock_fd, 0o700)
       owner_fd = os.open(
           "owner",
           os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
           0o600,
           dir_fd=lock_fd,
       )
       owner_created = True
       try:
           started = datetime.datetime.now(datetime.timezone.utc).strftime(
               "%Y-%m-%dT%H:%M:%SZ"
           )
           owner = (
               f"pid={os.getpid()}\nmode=prepare\nsha={sha}\n"
               f"started={started}\n"
           ).encode("ascii")
           if os.write(owner_fd, owner) != len(owner):
               raise SystemExit("short write to deployment-lock owner file")
           os.fchmod(owner_fd, 0o600)
           os.fsync(owner_fd)
       finally:
           os.close(owner_fd)

       releases_fd = os.open(
           "releases",
           os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
           dir_fd=root_fd,
       )
       try:
           releases_st = os.fstat(releases_fd)
           if releases_st.st_uid != os.geteuid() or releases_st.st_mode & 0o022:
               raise SystemExit("releases ownership or mode is unsafe")
           release_fd = os.open(
               sha,
               os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
               dir_fd=releases_fd,
           )
           try:
               release_st = os.fstat(release_fd)
               if release_st.st_uid != os.geteuid():
                   raise SystemExit("prepared release has the wrong owner")
               if release_st.st_mode & 0o022:
                   raise SystemExit("prepared release is writable by group/world")
               version_fd = os.open(
                   "version.json",
                   os.O_RDONLY | os.O_NOFOLLOW,
                   dir_fd=release_fd,
               )
               try:
                   version_st = os.fstat(version_fd)
                   if (
                       not stat.S_ISREG(version_st.st_mode)
                       or version_st.st_nlink != 1
                       or version_st.st_size > 4096
                   ):
                       raise SystemExit("prepared version.json is unsafe")
                   version = json.loads(os.read(version_fd, 4097).decode("utf-8"))
               finally:
                   os.close(version_fd)
               if version.get("commitSha") != sha:
                   raise SystemExit("prepared release SHA marker mismatch")
           finally:
               os.close(release_fd)
       finally:
           os.close(releases_fd)

       try:
           os.stat("current", dir_fd=root_fd, follow_symlinks=False)
       except FileNotFoundError:
           pass
       else:
           raise SystemExit("current already exists, including as a symlink")
       target = f"releases/{sha}"
       os.symlink(target, "current", dir_fd=root_fd)
       current_st = os.stat("current", dir_fd=root_fd, follow_symlinks=False)
       if not stat.S_ISLNK(current_st.st_mode):
           raise SystemExit("current was not created as a symlink")
       if current_st.st_uid != os.geteuid():
           raise SystemExit("current symlink has the wrong owner")
       if os.readlink("current", dir_fd=root_fd) != target:
           raise SystemExit("current symlink target mismatch")
   finally:
       if lock_fd is not None:
           if owner_created:
               os.unlink("owner", dir_fd=lock_fd)
           os.close(lock_fd)
       if lock_created:
           os.rmdir(".deploy.lock", dir_fd=root_fd)
       os.close(root_fd)
   PY
   ```

7. Back up the exact confirmed `raddadband.com` vhost file separately. Change
   only that vhost's `DocumentRoot` to the confirmed `current` path and add only
   the reviewed, path-specific `<Directory>` and `Alias` rules from the
   discovery record. Do not broaden access to `/srv`. Do not alter the Lazy
   Punks vhost unless the approved relationship plan specifically requires it.
8. Run `apachectl configtest` or the recorded equivalent, inspect the vhost
   mapping again with `apachectl -S`, and reload only with the exact approved
   server command. If any public check fails, restore the saved vhost file using
   the recorded restore command, config-test, reload, and leave the legacy tree
   untouched.
9. Run the public URL, SHA, title, exact-path, browser, TLS, `Alias`, and
   dual-domain non-disclosure checks in the verification procedure below, but
   do not yet claim that full production verification passed. At this bootstrap
   point, `list` must show the prepared SHA as current and
   `INSTALLED-UNHEALTHY`; requiring `HEALTHY` here would be circular because
   only a successful `deploy` records that state. Restore the saved vhost and
   stop if any public check fails.
10. Run the workflow with `production_action=deploy` for the same SHA. Because
    `current` already points to that publicly inspected release, this exercises
    the helper's complete public health check without changing the selected
    content. Then repeat the entire production verification procedure and
    require `list` to show that SHA as current and `HEALTHY`.

This establishes one compliant baseline. The rollback drill requires a second
reviewed `main` SHA: deploy that next SHA, roll back to the prepared baseline,
verify it, and then redeploy the newer SHA. Never claim rollback is tested when
only one compliant release exists.

## What a production dry run does and does not prove

In GitHub, open **Actions → Test, Package, and Deploy Site → Run workflow**,
select `main`, choose `dry-run`, and verify the run's displayed 40-character SHA
before approving the `production` Environment. The required `test` job must
finish successfully first.

The dry run builds and verifies the exact artifact, verifies the installed
helper hash, checks SSH host identity and credentials, uploads a temporary
archive to the private incoming path, and asks the helper to validate the
artifact and release layout. It removes its uploaded archive afterward. It does
not install a release or change `current`.

A successful dry run does **not** prove any of the following:

- that Apache uses the intended vhost or can follow/read `current`;
- that the two domains are independent;
- that SELinux will label a release correctly after a staging rename;
- that shared aliases, DNS, TLS, CDN behavior, or every asset works;
- that the legacy backup is restorable;
- that no deployment already admitted through GitHub is pending.

Those are separate discovery, `prepare`, cutover, and verification gates. Do not
describe a dry run as an end-to-end production test.

## Controlled first rollout

Keep both `PROD_REMOTE_ACTIONS_ENABLED=false` and
`PROD_AUTO_DEPLOY_ENABLED=false` while completing this checklist:

1. Confirm every discovery-record field and mandatory stop condition, the
   `main` ruleset, deployment code owners, the exact allowlist, and the server
   backup. Jeff and Che must approve the recorded plan.
2. Merge the reviewed automation through the protected pull-request path only
   after the required `test` check passes. Confirm the resulting exact `main`
   SHA.
3. Record the approved vhost intent as exactly `separate-roots` or
   `shared-root-approved`. Only after the dated discovery record and GitHub
   gates are approved, set `PROD_DISCOVERY_RECORD_APPROVED=true`,
   `PROD_GITHUB_GATES_APPROVED=true`, and finally
   `PROD_REMOTE_ACTIONS_ENABLED=true` through a separately recorded settings
   change. Leave automatic deployment disabled.
4. Run the protected `dry-run`; a non-initiating reviewer must approve the
   Environment gate. Its log must identify the intended release and paths
   without changing `current`.
5. For the first cutover, complete the `prepare` and Apache steps in the
   clean-layout bootstrap above. Record Jeff's and Che's approval of the
   observed paths and result.
6. Run the protected workflow with `production_action=deploy` for the exact
   current `main` SHA.
7. Complete every command and browser check in
   [Production verification](#production-verification), including both domains
   and the exact public SHA.
8. Review the GitHub logs for unexpected environment dumps, PEM headers,
   credential-bearing URLs, or SSH diagnostic output. Do not search by printing
   an actual secret. Record that no secret value is visible.
9. Confirm GitHub Pages and the ChatGPT Sites URL still work independently and
   were not reconfigured.
10. After a second reviewed SHA exists, perform the rollback drill below.
11. Complete the legacy-root quarantine procedure. Do not delete it.
12. Only after both owners accept the deployment, rollback, redeployment,
    quarantine, and verification evidence, set
    `PROD_AUTO_DEPLOY_ENABLED=true`.

If truly unattended push-to-`main` deployment is desired, the Environment's
required-reviewer rule can be removed only through a reviewed settings change
after this checklist. Record the approvers and retained ruleset protections.
Keeping the reviewer rule is also valid; in that case each otherwise automatic
deployment waits for human approval.

## Production verification

Use the exact workflow SHA, not an abbreviated value:

```bash
set -Eeuo pipefail
SITE_URL='https://raddadband.com'
EXPECTED_SHA='<FILL IN EXACT 40-CHARACTER WORKFLOW SHA>'
EXPECTED_TITLE='<FILL IN TITLE FROM THAT REVIEWED COMMIT>'
[[ "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]]

VERSION_JSON="$(
  curl --proto '=https' --fail --silent --show-error \
    -H 'Accept: application/json' \
    -H 'Cache-Control: no-cache' \
    "$SITE_URL/version.json?v=$EXPECTED_SHA"
)"
printf '%s' "$VERSION_JSON" |
  python3 -c '
import json
import sys
expected = sys.argv[1]
value = json.load(sys.stdin)
if set(value) != {"commitSha", "timestamp"}:
    raise SystemExit("unexpected version.json fields")
if value["commitSha"] != expected:
    raise SystemExit("production SHA mismatch")
print(value["commitSha"], value["timestamp"])
' "$EXPECTED_SHA"

HOME_PAGE="$(
  curl --proto '=https' --fail --silent --show-error \
    -H 'Cache-Control: no-cache' "$SITE_URL/"
)"
printf '%s' "$HOME_PAGE" | grep -F -- "<title>$EXPECTED_TITLE</title>"
```

Require HTTP 200 for every exact production path:

```bash
set -Eeuo pipefail
SITE_URL='https://raddadband.com'
EXPECTED_SHA='<FILL IN EXACT 40-CHARACTER WORKFLOW SHA>'
[[ "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]]
production_paths=(
  RadDad_Logo.jpg
  SHA256SUMS
  artifact-manifest.json
  assets/rad-dad-friends-guitars-growlers-2026-1122.webp
  assets/rad-dad-friends-guitars-growlers-2026-561.webp
  assets/rad-dad-friends-guitars-growlers-2026-v2-1024.webp
  assets/rad-dad-friends-guitars-growlers-2026-v2-512.webp
  assets/rad-dad-friends-guitars-growlers-2026-v2-full.png
  assets/rad-dad-friends-guitars-growlers-2026-full.png
  assets/rad-dad-friends-guitars-growlers-2026.ics
  assets/rad-dad-social-2026-v2.png
  assets/rad-dad-social-2026.png
  assets/rad-dad-tap-og.png
  assets/story-of-us-cassette-render.webp
  assets/story-of-us-cover.webp
  assets/the-middle-jimmy-eat-world-thumbnail.webp
  assets/wildflower-2026-poster-720.webp
  assets/wildflower-she-green-day.webp
  index.html
  nfc/index.html
  qr/index.html
  qr/script.js
  qr/styles.css
  script.js
  show-state.js
  styles.css
  tap/index.html
  version.json
)
for path in "${production_paths[@]}"; do
  code="$(
    curl --proto '=https' --silent --show-error \
      --output /dev/null --write-out '%{http_code}' \
      "$SITE_URL/$path?v=$EXPECTED_SHA"
  )"
  test "$code" = 200 || {
    printf '%s returned %s, expected 200\n' "$path" "$code" >&2
    exit 1
  }
done
```

Require HTTP 404 for representative development, credential, repository, and
legacy-copy paths. Run the same non-disclosure checks against both public
domains even when their intended content differs:

```bash
set -Eeuo pipefail
public_origins=(
  https://raddadband.com
  https://lazypunksunite.com
)
forbidden_paths=(
  .git/HEAD
  .github/workflows/test.yml
  .openai/hosting.json
  .env
  README.md
  package.json
  package-lock.json
  scripts/build-sites.mjs
  tests/e2e/homepage.spec.js
  test-results/
  node_modules/
  GPT/
  backup_restore_point/index.html
  worker/index.js
  RadDad_OnePage_Site.zip
)
for origin in "${public_origins[@]}"; do
  for path in "${forbidden_paths[@]}"; do
    code="$(
      curl --proto '=https' --silent --show-error \
        --output /dev/null --write-out '%{http_code}' \
        "$origin/$path"
    )"
    test "$code" = 404 || {
      printf '%s/%s returned %s, expected 404\n' \
        "$origin" "$path" "$code" >&2
      exit 1
    }
  done
done
```

Then complete and record:

- desktop and mobile browser checks of the home page and navigation;
- flyer source selection, full flyer, logo, social image, custom video
  thumbnail, Wildflower poster, CSS, JavaScript, and calendar download;
- every internal link and page anchor;
- HTTPS certificate/hostname validity and no mixed-content warning;
- the approved server-managed `Alias` paths;
- `raddad-deploy list`, showing the public SHA as current and `HEALTHY`;
- independence of GitHub Pages and ChatGPT Sites;
- GitHub log review confirming no secret value is visible.

Any missing asset, unexpected redirect/status, SHA mismatch, broken release, or
secret disclosure is a failed verification. Disable automation and use the
known-good rollback procedure.

## Rollback selection and drill

Never choose a rollback target by directory modification time or by taking the
first SHA returned by `ls`. The helper maintains health-success state in its
private, atomic `.known-good` ledger outside the immutable release directories.
Its read-only inventory validates that ledger and the release checksums:

```bash
set -Eeuo pipefail
DEPLOY_USER='<FILL IN DEDICATED USER>'
sudo -H -u "$DEPLOY_USER" \
  /usr/local/libexec/raddad-deploy list \
  --config /etc/raddad-deploy.conf
```

Never inspect or edit `.known-good` to select a target; `list` is the operator
interface. Select a non-current target reported as `HEALTHY` whose SHA and
successful workflow/rollout record are known. Never select
`INSTALLED-UNHEALTHY`, `BROKEN`, an unmarked directory, or the dirty legacy
root. If no previous `HEALTHY` release exists, stop and use the recorded
host-backup recovery plan.

To prove rollback before enabling automatic deployment:

1. Record the current SHA from public `version.json` and from `list`.
2. Record the chosen previous `HEALTHY` SHA and its workflow link.
3. From Che's authenticated session, run:

   ```bash
   set -Eeuo pipefail
   DEPLOY_USER='<FILL IN DEDICATED USER>'
   PREVIOUS_SHA='<FILL IN PREVIOUS HEALTHY 40-CHARACTER SHA>'
   [[ "$PREVIOUS_SHA" =~ ^[0-9a-f]{40}$ ]]
   sudo -H -u "$DEPLOY_USER" \
     /usr/local/libexec/raddad-deploy rollback \
     --sha "$PREVIOUS_SHA" \
     --config /etc/raddad-deploy.conf
   ```

4. Complete production verification using the previous release's expected title
   and SHA.
5. Manually run the protected workflow on the current `main` SHA with
   `production_action=deploy`, then verify it again.
6. Run `list` and save both SHA observations, status output, workflow links, and
   Jeff/Che acceptance in the rollout record.

The helper automatically restores the previous `HEALTHY` symlink when a
post-activation public health check fails. A failed or merely prepared release
is not marked healthy and is not an eligible rollback target.

## Release retention and cleanup

After a successful deployment, the helper protects the current and immediately
previous healthy releases, removes failed/unmarked releases before healthy
history, and retains up to `RADDAD_RETENTION_COUNT` eligible releases. It never
uses a repository clone or legacy root as a release.

Use `raddad-deploy list` and filesystem-capacity monitoring to inspect retention.
Do not manually run `rm -rf`, use an unrestricted `rsync --delete`, or delete a
SHA directory behind the helper. Before lowering retention, record which
healthy releases and independent server backup preserve the required rollback
window.

Workflow uploads are removed after each normal run. If a host or workstation
crash leaves an incoming archive or staging directory, first verify that there
is no deployment lock or process and record the exact path and owning run.
The current helper has no stale-artifact cleanup mode. Do not improvise one:
quarantine each exact, independently verified entry through a separately
approved incident procedure that uses no-follow directory descriptors and an
exclusive destination, or leave it in place for the next helper invocation to
reject and investigate. Do not use a wildcard or recursively delete the release
root.

## Normal operation

After `PROD_REMOTE_ACTIONS_ENABLED=true` and
`PROD_AUTO_DEPLOY_ENABLED=true`, a push to `main` deploys only while all
discovery, GitHub-control, and vhost-intent gates remain approved and only after
its tests, clean build, manifest verification, and protected Environment gate
succeed. Pull requests never run the production job and never receive
production secrets. Immediately before activation, the workflow confirms that
its tested SHA is still the tip of `origin/main`; an older, slower workflow run
cannot overwrite a newer release.

To make a controlled deployment while automatic mode is disabled, run the
workflow manually on `main` and choose `deploy`. Use `dry-run` whenever server
paths, permissions, keys, vhost configuration, or SELinux policy have changed.
Re-run the full verification procedure after every deployment.

### Identify the live commit

Read the public version marker without relying on a browser cache:

```bash
set -Eeuo pipefail
curl --fail --silent --show-error \
  "https://raddadband.com/version.json?v=<expected-40-character-sha>"
```

Its `commitSha` must exactly match the SHA shown by the successful GitHub
workflow run. Its timestamp identifies the deterministic build input; it is not
an assertion of the wall-clock deployment time.

## Quarantine the legacy root without deleting it

Do this only after two healthy releases exist, the deployment/rollback/
redeployment drill passes, both vhost relationships are rechecked, and the
recorded backup is still restorable.

1. Confirm with `apachectl -S`, the two exact vhost files, `readlink -e`, and
   `stat` that neither public domain nor any `Alias` uses the legacy root. If
   Lazy Punks intentionally still uses it, stop until its required content has
   a separately approved clean home.
2. Inventory the legacy root and compare it with the backup inventory.
3. Choose a pre-existing, canonical, root-owned mode-`0700` quarantine parent
   outside every `DocumentRoot`, release root, deployment home, and
   shared-content path. Record and approve its creation separately; the move
   below deliberately will not create or chmod a supplied path.
4. Fill the literal paths. The single root process below validates both path
   entries without following their final components and makes a recoverable
   same-filesystem rename only after every check passes:

   ```bash
   set -Eeuo pipefail
   LEGACY_ROOT='<FILL IN CONFIRMED LEGACY ROOT>'
   QUARANTINE_PARENT='<FILL IN CONFIRMED PRIVATE QUARANTINE PARENT>'
   QUARANTINE_ID='<FILL IN APPROVED UNIQUE BACKUP/TIMESTAMP LABEL>'
   [[ "$QUARANTINE_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]
   sudo python3 - \
     "$LEGACY_ROOT" "$QUARANTINE_PARENT" "$QUARANTINE_ID" <<'PY'
   import os
   import stat
   import sys

   legacy, quarantine, quarantine_id = sys.argv[1:]
   too_broad = {"/", "/etc", "/home", "/root", "/srv", "/tmp", "/usr", "/var"}
   for label, path in (("legacy", legacy), ("quarantine", quarantine)):
       if not os.path.isabs(path) or os.path.normpath(path) != path:
           raise SystemExit(f"{label} path must be absolute and normalized")
       if path in too_broad:
           raise SystemExit(f"{label} path is too broad")
       if os.path.realpath(path) != path:
           raise SystemExit(f"{label} path must be canonical")
   if (
       os.path.commonpath((legacy, quarantine)) == legacy
       or os.path.commonpath((legacy, quarantine)) == quarantine
   ):
       raise SystemExit("legacy and quarantine paths must not overlap")

   legacy_parent = os.path.dirname(legacy)
   legacy_name = os.path.basename(legacy)
   legacy_parent_fd = os.open(
       legacy_parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
   )
   quarantine_fd = os.open(
       quarantine, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
   )
   try:
       legacy_parent_st = os.fstat(legacy_parent_fd)
       if legacy_parent_st.st_uid != 0 or legacy_parent_st.st_mode & 0o022:
           raise SystemExit("legacy parent is not root-controlled")
       quarantine_st = os.fstat(quarantine_fd)
       if quarantine_st.st_uid != 0:
           raise SystemExit("quarantine parent must be root-owned")
       if stat.S_IMODE(quarantine_st.st_mode) != 0o700:
           raise SystemExit("quarantine parent mode must be exactly 0700")

       legacy_st = os.stat(
           legacy_name, dir_fd=legacy_parent_fd, follow_symlinks=False
       )
       if stat.S_ISLNK(legacy_st.st_mode) or not stat.S_ISDIR(legacy_st.st_mode):
           raise SystemExit("legacy root must be a real directory")
       if legacy_st.st_dev != quarantine_st.st_dev:
           raise SystemExit("legacy and quarantine paths are not on one filesystem")
       try:
           os.stat(quarantine_id, dir_fd=quarantine_fd, follow_symlinks=False)
       except FileNotFoundError:
           pass
       else:
           raise SystemExit("quarantine destination already exists")

       os.rename(
           legacy_name,
           quarantine_id,
           src_dir_fd=legacy_parent_fd,
           dst_dir_fd=quarantine_fd,
       )
       moved_st = os.stat(
           quarantine_id, dir_fd=quarantine_fd, follow_symlinks=False
       )
       if (moved_st.st_dev, moved_st.st_ino) != (
           legacy_st.st_dev,
           legacy_st.st_ino,
       ):
           raise SystemExit("renamed object identity changed unexpectedly")
       print(os.path.join(quarantine, quarantine_id))
   finally:
       os.close(quarantine_fd)
       os.close(legacy_parent_fd)
   PY
   ```

5. Config-test and reload with the approved commands, then repeat the
   production and dual-domain forbidden-path verification.
6. Record the quarantine path, owner, backup, restore command, and retention
   deadline.

Do not delete the quarantined tree as part of deployment. Its eventual removal
requires a separate approved change after the retention deadline and a fresh
proof that no vhost, alias, certificate renewal, upload, or rollback depends on
it.

## Disable and recover

For an emergency stop:

1. Set the repository variables `PROD_REMOTE_ACTIONS_ENABLED=false` and
   `PROD_AUTO_DEPLOY_ENABLED=false`. The master switch blocks future manual and
   push-triggered SSH jobs; neither setting retracts a job that GitHub already
   admitted.
2. In the `production` Environment, reject every pending approval. Cancel queued
   workflow runs that have not opened an SSH session.
3. Inspect the server-side lock from Che's session:

   ```bash
   set -Eeuo pipefail
   RELEASE_ROOT='<FILL IN CONFIRMED RELEASE ROOT>'
   DEPLOY_USER='<FILL IN DEDICATED USER>'
   sudo python3 - "$RELEASE_ROOT" "$DEPLOY_USER" <<'PY'
   import os
   import pwd
   import stat
   import sys

   root, user = sys.argv[1:]
   account = pwd.getpwnam(user)
   if not os.path.isabs(root) or os.path.normpath(root) != root:
       raise SystemExit("release root must be absolute and normalized")
   if root in {"/", "/etc", "/home", "/root", "/srv", "/tmp", "/usr", "/var"}:
       raise SystemExit("release root is too broad")
   if os.path.realpath(root) != root:
       raise SystemExit("release root must be canonical")
   root_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
   try:
       root_st = os.fstat(root_fd)
       if root_st.st_uid != account.pw_uid or root_st.st_mode & 0o022:
           raise SystemExit("release root ownership or mode is unsafe")
       try:
           lock_fd = os.open(
               ".deploy.lock",
               os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
               dir_fd=root_fd,
           )
       except FileNotFoundError:
           print("no deployment lock")
           raise SystemExit(0)
       try:
           lock_st = os.fstat(lock_fd)
           if lock_st.st_uid != account.pw_uid:
               raise SystemExit("deployment lock has the wrong owner")
           if stat.S_IMODE(lock_st.st_mode) != 0o700:
               raise SystemExit("deployment lock mode must be exactly 0700")
           owner_fd = os.open(
               "owner", os.O_RDONLY | os.O_NOFOLLOW, dir_fd=lock_fd
           )
           try:
               owner_st = os.fstat(owner_fd)
               if not stat.S_ISREG(owner_st.st_mode) or owner_st.st_nlink != 1:
                   raise SystemExit("unsafe deployment-lock owner file")
               if owner_st.st_uid != account.pw_uid:
                   raise SystemExit("deployment-lock owner file has wrong owner")
               if owner_st.st_size > 4096:
                   raise SystemExit("deployment-lock owner file is too large")
               print(os.read(owner_fd, 4097).decode("ascii"), end="")
           finally:
               os.close(owner_fd)
       finally:
           os.close(lock_fd)
   finally:
       os.close(root_fd)
   PY
   ```

4. If the recorded PID is still running, do not delete the lock or kill the
   process merely because GitHub appears stalled. An Actions cancellation can
   interrupt SSH after a symlink swap and before health restoration. Allow the
   helper to finish when safe, then run `list` and production verification.
5. If a run was interrupted or its state is uncertain, wait until no helper
   process is active, inspect `list`, verify the public SHA, and roll back to the
   chosen previous `HEALTHY` release.
6. Leave automation disabled until the incident and every queued/running run are
   reconciled.

To recover, use the versioned release rollback procedure, verify the public
SHA and site health, and leave automatic mode disabled until the incident is
understood. Because activation is a symlink swap, rollback does not require a
new build.

The helper uses `<confirmed-release-root>/.deploy.lock` to serialize
server-side changes and writes an `owner` file containing the PID, mode, SHA,
and start time. The helper intentionally has no stale-lock recovery command.
Only after automatic deployment is disabled, queued/running workflows and SSH
sessions are reconciled, Che confirms that the recorded PID is gone, and an
incident owner approves the exact lock may Che run the procedure below. It
refuses every deployment-user process, validates the recorded owner data and
anchored inode types, and removes only `owner` plus that one lock directory:

```bash
set -Eeuo pipefail
RELEASE_ROOT='<FILL IN CONFIRMED RELEASE ROOT>'
DEPLOY_USER='<FILL IN DEDICATED USER>'
INCIDENT_ID='<FILL IN APPROVED INCIDENT ID>'
SITE_URL='https://raddadband.com'
[[ "$INCIDENT_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]

sudo python3 - "$RELEASE_ROOT" "$DEPLOY_USER" "$INCIDENT_ID" <<'PY'
import datetime
import os
import pwd
import re
import stat
import sys

root, user, incident_id = sys.argv[1:]
account = pwd.getpwnam(user)
too_broad = {"/", "/etc", "/home", "/root", "/srv", "/tmp", "/usr", "/var"}
if not os.path.isabs(root) or os.path.normpath(root) != root:
    raise SystemExit("release root must be absolute and normalized")
if root in too_broad or os.path.realpath(root) != root:
    raise SystemExit("release root is broad or non-canonical")

active = []
for entry in os.scandir("/proc"):
    if not entry.name.isdigit() or int(entry.name) == os.getpid():
        continue
    try:
        with open(f"/proc/{entry.name}/status", encoding="ascii") as handle:
            uid_line = next(line for line in handle if line.startswith("Uid:"))
        real_uid = int(uid_line.split()[1])
        if real_uid == account.pw_uid:
            with open(f"/proc/{entry.name}/cmdline", "rb") as handle:
                command = handle.read(4096).replace(b"\0", b" ").decode(
                    "utf-8", "replace"
                )
            active.append(f"{entry.name}:{command}")
    except (FileNotFoundError, PermissionError, ProcessLookupError, StopIteration):
        continue
if active:
    raise SystemExit(
        "deployment user still has active processes: " + "; ".join(active)
    )

root_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
try:
    root_st = os.fstat(root_fd)
    if root_st.st_uid != account.pw_uid or root_st.st_mode & 0o022:
        raise SystemExit("release root ownership or mode is unsafe")
    lock_fd = os.open(
        ".deploy.lock",
        os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
        dir_fd=root_fd,
    )
    try:
        lock_st = os.fstat(lock_fd)
        if lock_st.st_uid != account.pw_uid:
            raise SystemExit("deployment lock has the wrong owner")
        if stat.S_IMODE(lock_st.st_mode) != 0o700:
            raise SystemExit("deployment lock mode must be exactly 0700")
        if sorted(os.listdir(lock_fd)) != ["owner"]:
            raise SystemExit("deployment lock has unexpected entries")

        owner_fd = os.open("owner", os.O_RDONLY | os.O_NOFOLLOW, dir_fd=lock_fd)
        try:
            owner_st = os.fstat(owner_fd)
            if (
                not stat.S_ISREG(owner_st.st_mode)
                or owner_st.st_nlink != 1
                or owner_st.st_uid != account.pw_uid
                or owner_st.st_size > 4096
            ):
                raise SystemExit("deployment-lock owner file is unsafe")
            raw = os.read(owner_fd, 4097).decode("ascii")
        finally:
            os.close(owner_fd)

        pairs = {}
        for line in raw.splitlines():
            if "=" not in line:
                raise SystemExit("malformed deployment-lock owner data")
            key, value = line.split("=", 1)
            if key in pairs:
                raise SystemExit("duplicate deployment-lock owner field")
            pairs[key] = value
        if set(pairs) != {"pid", "mode", "sha", "started"}:
            raise SystemExit("unexpected deployment-lock owner fields")
        if not re.fullmatch(r"[1-9][0-9]*", pairs["pid"]):
            raise SystemExit("invalid recorded PID")
        if pairs["mode"] not in {"check", "prepare", "deploy", "rollback"}:
            raise SystemExit("invalid recorded deployment mode")
        if not re.fullmatch(r"[0-9a-f]{40}", pairs["sha"]):
            raise SystemExit("invalid recorded deployment SHA")
        try:
            datetime.datetime.strptime(pairs["started"], "%Y-%m-%dT%H:%M:%SZ")
        except ValueError as error:
            raise SystemExit("invalid recorded start time") from error
        try:
            os.kill(int(pairs["pid"]), 0)
        except ProcessLookupError:
            pass
        else:
            raise SystemExit("recorded PID still exists; refusing lock removal")

        path_st = os.stat(
            ".deploy.lock", dir_fd=root_fd, follow_symlinks=False
        )
        if (path_st.st_dev, path_st.st_ino) != (lock_st.st_dev, lock_st.st_ino):
            raise SystemExit("deployment lock changed during inspection")
        os.unlink("owner", dir_fd=lock_fd)
        path_st = os.stat(
            ".deploy.lock", dir_fd=root_fd, follow_symlinks=False
        )
        if (path_st.st_dev, path_st.st_ino) != (lock_st.st_dev, lock_st.st_ino):
            raise SystemExit("deployment lock changed before removal")
        os.rmdir(".deploy.lock", dir_fd=root_fd)
        print(
            f"removed one stale deployment lock for incident {incident_id}; "
            f"pid={pairs['pid']} mode={pairs['mode']} sha={pairs['sha']} "
            f"started={pairs['started']}"
        )
    finally:
        os.close(lock_fd)
finally:
    os.close(root_fd)
PY

sudo -H -u "$DEPLOY_USER" \
  /usr/local/libexec/raddad-deploy list \
  --config /etc/raddad-deploy.conf
curl --proto '=https' --fail --silent --show-error \
  -H 'Cache-Control: no-cache' "$SITE_URL/version.json"
```

Save the command output in the incident record. If any validation refuses the
operation, do not use `rm`, `rmdir`, or a wildcard as a workaround; investigate
the conflicting process or filesystem state. After removal, compare `list`,
the public SHA, and the last accepted deployment record before any new deploy
is admitted.

## Key rotation and revocation

### Planned Actions-key rotation

1. Disable automatic deployment and reconcile queued/running jobs.
2. Repeat the dedicated key-generation procedure with a new dated comment and
   empty passphrase. Record the new fingerprint.
3. Append the new restricted public key beside the old one. Do not overwrite
   `authorized_keys`.
4. Replace `PROD_SSH_PRIVATE_KEY` directly in the GitHub `production`
   Environment.
5. Run the protected manual `dry-run`. Because GitHub now holds only the new
   private key, success proves the new authorized key works.
6. On the server, list fingerprints and comments:

   ```bash
   set -Eeuo pipefail
   DEPLOY_HOME='<FILL IN CONFIRMED HOME>'
   DEPLOY_USER='<FILL IN DEDICATED USER>'
   AUTHORIZED_KEYS="$DEPLOY_HOME/.ssh/authorized_keys"
   test "$(getent passwd "$DEPLOY_USER" | cut -d: -f6)" = "$DEPLOY_HOME"
   sudo -H -u "$DEPLOY_USER" \
     ssh-keygen -lf "$AUTHORIZED_KEYS" -E sha256
   sudo -H -u "$DEPLOY_USER" nl -ba "$AUTHORIZED_KEYS"
   ```

7. Match the old recorded fingerprint and unique comment to exactly one line.
   Make a mode-`0600`, timestamped copy in Che's private administrative
   directory by reading the file as the deployment user, not as root. Edit the
   original as the deployment user (for example, with
   `sudoedit -u <deployment-user>`) and remove only that old line. This keeps a
   deployment-user-controlled path out of a root file read/write operation.
   Stop if the fingerprint/comment is missing or matches more than one line.
8. Re-run the fingerprint listing and a protected `dry-run`. Remove the
   temporary private-key file from the trusted workstation according to the
   secure-media policy, and update the fingerprint record.

### Suspected Actions-key compromise

Set automatic mode false, reject pending approvals, and remove the exact
compromised public-key line from the server **before** issuing a replacement.
Removing it does not terminate an already authenticated session, so inspect the
deployment lock, running processes, auth logs, Environment deployment history,
release inventory, and public SHA. Delete or replace the compromised GitHub
secret, rotate with a new fingerprint, and keep automation disabled through a
full dry run and incident review. Never disable the whole deployment account or
erase all of `authorized_keys` unless the separately approved incident plan
requires it.

### SSH host-key rotation

An unexpected host-key change is a stop condition, not a reason to accept the
new key. Disable automation; obtain the new public host key from the server
console/control plane and a second out-of-band source; calculate and record its
SHA-256 fingerprint; construct the exact hostname/port `known_hosts` line; and
replace only `PROD_SSH_KNOWN_HOSTS`. Run a protected `dry-run` before restoring
automation. Never use `StrictHostKeyChecking=no` or trust `ssh-keyscan` alone.

## GitHub Actions outage

An Actions outage does not take the current site offline; the `current` symlink
continues serving the last healthy release. Prefer waiting for Actions rather
than bypassing the test-and-artifact chain.

The default outage recovery is local rollback to a retained `HEALTHY` release
using `raddad-deploy list` and the exact rollback procedure above. This requires
neither GitHub nor a new build.

An urgent new release is allowed only if GitHub's run metadata and artifact
download services remain available and all of these facts can be independently
proved:

- the source run belongs to `rupret007/RadDadSite`;
- its branch is `main`, its event is `push` or `workflow_dispatch`, and its
  overall conclusion and `test` job are successful;
- its exact 40-character `headSha` equals the approved current `origin/main`
  commit;
- the artifact name is exactly `production-site-<headSha>`;
- Jeff and Che approve the break-glass deployment and record the run URL;
- merges to `main` are paused for the short, recorded break-glass window so the
  approved SHA cannot become stale between proof and activation.

Artifacts exist for pull requests and other branches too. Never deploy one,
even if its manifest and checksums verify. If Actions run metadata, the named
artifact, GitHub access, or any provenance fact is unavailable, **no new
release is possible during the outage**. Continue serving or roll back to a
retained healthy release.

On a trusted workstation with an already authenticated GitHub CLI, inspect the
run without printing its authentication token:

```bash
set -Eeuo pipefail
REPOSITORY='rupret007/RadDadSite'
RUN_ID='<FILL IN APPROVED SUCCESSFUL MAIN RUN ID>'
SHA='<FILL IN EXACT APPROVED 40-CHARACTER HEAD SHA>'
[[ "$RUN_ID" =~ ^[0-9]+$ ]]
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]]

gh run view "$RUN_ID" --repo "$REPOSITORY" \
  --json url,headSha,headBranch,event,conclusion
test "$(
  gh run view "$RUN_ID" --repo "$REPOSITORY" --json headSha --jq .headSha
)" = "$SHA"
test "$(
  gh run view "$RUN_ID" --repo "$REPOSITORY" --json headBranch --jq .headBranch
)" = main
case "$(
  gh run view "$RUN_ID" --repo "$REPOSITORY" --json event --jq .event
)" in
  push|workflow_dispatch) ;;
  *) printf 'Run event is not trusted for production\n' >&2; exit 1 ;;
esac
test "$(
  gh run view "$RUN_ID" --repo "$REPOSITORY" --json conclusion --jq .conclusion
)" = success
test "$(
  gh run view "$RUN_ID" --repo "$REPOSITORY" --json jobs \
    --jq '.jobs[] | select(.name == "test") | .conclusion'
)" = success
```

Use an exact clean checkout of that commit and confirm it remains current
`main`. Download into a new empty directory:

```bash
set -Eeuo pipefail
REPOSITORY='rupret007/RadDadSite'
REPOSITORY_URL='https://github.com/rupret007/RadDadSite.git'
RUN_ID='<FILL IN APPROVED SUCCESSFUL MAIN RUN ID>'
SHA='<FILL IN EXACT APPROVED 40-CHARACTER HEAD SHA>'
[[ "$RUN_ID" =~ ^[0-9]+$ ]]
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]]
node --version
test "$(node -p 'process.versions.node.split(".")[0]')" = 24

OUTAGE_ROOT="$(mktemp -d)"
SOURCE_DIR="$OUTAGE_ROOT/source"
ARTIFACT_DIR="$OUTAGE_ROOT/production-site"
ARCHIVE="$OUTAGE_ROOT/raddad-$SHA.tar.gz"
git clone --no-checkout "$REPOSITORY_URL" "$SOURCE_DIR"
test "$(git -C "$SOURCE_DIR" remote get-url origin)" = "$REPOSITORY_URL"
git -C "$SOURCE_DIR" fetch --prune origin main
test "$(git -C "$SOURCE_DIR" rev-parse --verify origin/main^{commit})" = "$SHA"
git -C "$SOURCE_DIR" checkout --detach "$SHA"
test "$(git -C "$SOURCE_DIR" rev-parse --verify HEAD^{commit})" = "$SHA"
test -z "$(git -C "$SOURCE_DIR" status --porcelain)"
mkdir -m 0700 "$ARTIFACT_DIR"
gh run download "$RUN_ID" --repo "$REPOSITORY" \
  --name "production-site-$SHA" --dir "$ARTIFACT_DIR"
npm --prefix "$SOURCE_DIR" run verify:production -- \
  --artifact-dir "$ARTIFACT_DIR" \
  --expected-sha "$SHA"
COPYFILE_DISABLE=1 tar -C "$ARTIFACT_DIR" -czf "$ARCHIVE" .
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$ARCHIVE"
else
  shasum -a 256 "$ARCHIVE"
fi
test "$(
  git -C "$SOURCE_DIR" ls-remote --exit-code origin refs/heads/main | cut -f 1
)" = "$SHA"
```

Record the archive checksum. The dedicated Actions private key is not retained
on the workstation. Upload with Che's separately approved operator account and
the same independently pinned host key, first to a private operator path. The
server-side copy below refuses unless that path's parent is owned by the
operator and has mode exactly `0700`:

```bash
set -Eeuo pipefail
SHA='<FILL IN EXACT APPROVED 40-CHARACTER HEAD SHA>'
ARCHIVE='<FILL IN ABSOLUTE LOCAL ARCHIVE PATH>'
PROD_HOST='<FILL IN CONFIRMED SSH HOST>'
PROD_PORT='<FILL IN CONFIRMED SSH PORT>'
OPS_USER='<FILL IN APPROVED OPERATOR USER>'
KNOWN_HOSTS_FILE='<FILL IN VERIFIED KNOWN_HOSTS FILE>'
REMOTE_TEMP="<FILL IN PRIVATE OPERATOR DIRECTORY>/raddad-$SHA.tar.gz"

[[ "$SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$PROD_HOST" =~ ^[A-Za-z0-9.-]+$ ]]
[[ "$PROD_PORT" =~ ^[0-9]{1,5}$ ]]
((PROD_PORT >= 1 && PROD_PORT <= 65535))
[[ "$OPS_USER" =~ ^[a-z_][a-z0-9_-]*$ ]]
[[ "$ARCHIVE" == /* ]]
test -f "$ARCHIVE"
[[ "$REMOTE_TEMP" =~ ^/[A-Za-z0-9._/-]+$ ]]
[[ "$REMOTE_TEMP" != *"/../"* && "$REMOTE_TEMP" != *"/./"* ]]
test -f "$KNOWN_HOSTS_FILE"
scp -P "$PROD_PORT" \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=yes \
  -o "UserKnownHostsFile=$KNOWN_HOSTS_FILE" \
  "$ARCHIVE" "$OPS_USER@$PROD_HOST:$REMOTE_TEMP"
```

From Che's authenticated server session, use only the exact incoming path and
run the helper as the dedicated deployment user:

```bash
set -Eeuo pipefail
SHA='<FILL IN EXACT APPROVED 40-CHARACTER HEAD SHA>'
ARCHIVE_SHA256='<FILL IN RECORDED 64-CHARACTER ARCHIVE SHA-256>'
DEPLOY_USER='<FILL IN DEDICATED USER>'
DEPLOY_GROUP='<FILL IN DEDICATED PRIMARY GROUP>'
OPS_USER='<FILL IN APPROVED OPERATOR USER>'
INCOMING_ROOT='<FILL IN CONFIRMED PRIVATE INCOMING ROOT>'
REMOTE_TEMP='<FILL IN EXACT PRIVATE OPERATOR UPLOAD PATH>'
ARTIFACT_NAME="raddad-$SHA.tar.gz"
ARTIFACT="$INCOMING_ROOT/$ARTIFACT_NAME"

[[ "$SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$ARCHIVE_SHA256" =~ ^[0-9a-f]{64}$ ]]
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]]
[[ "$DEPLOY_GROUP" =~ ^[a-z_][a-z0-9_-]*$ ]]
[[ "$OPS_USER" =~ ^[a-z_][a-z0-9_-]*$ ]]
getent passwd "$DEPLOY_USER" >/dev/null
getent group "$DEPLOY_GROUP" >/dev/null
getent passwd "$OPS_USER" >/dev/null
test "$(id -gn "$DEPLOY_USER")" = "$DEPLOY_GROUP"

# Root opens the operator upload without following its final component, verifies
# it before creating anything, then creates the deployment-user destination
# exclusively through an anchored incoming-directory descriptor. It removes the
# exact uploaded inode after the safe copy, so no later root pathname cleanup is
# needed.
sudo python3 - \
  "$REMOTE_TEMP" "$INCOMING_ROOT" "$ARTIFACT_NAME" \
  "$DEPLOY_USER" "$DEPLOY_GROUP" "$OPS_USER" "$ARCHIVE_SHA256" <<'PY'
import grp
import hashlib
import os
import pwd
import re
import stat
import sys

source, incoming, artifact_name, user, group, ops_user, expected_hash = sys.argv[1:]
account = pwd.getpwnam(user)
group_entry = grp.getgrnam(group)
ops_account = pwd.getpwnam(ops_user)
if account.pw_gid != group_entry.gr_gid:
    raise SystemExit("confirmed group is not the deployment user's primary group")
for label, path in (("operator upload", source), ("incoming root", incoming)):
    if not os.path.isabs(path) or os.path.normpath(path) != path:
        raise SystemExit(f"{label} must be absolute and normalized")
if incoming in {"/", "/home", "/root", "/srv", "/tmp", "/usr", "/var"}:
    raise SystemExit("incoming root is too broad")
if os.path.realpath(incoming) != incoming:
    raise SystemExit("incoming root must be canonical")
if os.path.commonpath((source, incoming)) in (source, incoming):
    raise SystemExit("operator upload and incoming root must not overlap")
if not re.fullmatch(r"raddad-[0-9a-f]{40}\.tar\.gz", artifact_name):
    raise SystemExit("unexpected artifact filename")

source_parent = os.path.dirname(source)
source_name = os.path.basename(source)
if source_parent in {"/", "/etc", "/home", "/root", "/srv", "/tmp", "/usr", "/var"}:
    raise SystemExit("operator upload parent is too broad")
if os.path.realpath(source_parent) != source_parent:
    raise SystemExit("operator upload parent must be canonical")
source_parent_fd = os.open(
    source_parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
)
incoming_fd = os.open(
    incoming, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
)
destination_fd = None
try:
    source_parent_st = os.fstat(source_parent_fd)
    if source_parent_st.st_uid != ops_account.pw_uid:
        raise SystemExit("operator upload parent has the wrong owner")
    if stat.S_IMODE(source_parent_st.st_mode) != 0o700:
        raise SystemExit("operator upload parent mode must be exactly 0700")
    incoming_st = os.fstat(incoming_fd)
    if incoming_st.st_uid != account.pw_uid:
        raise SystemExit("incoming root has the wrong owner")
    if incoming_st.st_mode & 0o077:
        raise SystemExit("incoming root must not grant group/world access")

    source_fd = os.open(
        source_name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=source_parent_fd
    )
    try:
        source_st = os.fstat(source_fd)
        if not stat.S_ISREG(source_st.st_mode) or source_st.st_nlink != 1:
            raise SystemExit("operator upload must be a single-link regular file")
        if source_st.st_uid != ops_account.pw_uid or source_st.st_mode & 0o022:
            raise SystemExit("operator upload ownership or mode is unsafe")
        digest = hashlib.sha256()
        while True:
            chunk = os.read(source_fd, 1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
        if digest.hexdigest() != expected_hash:
            raise SystemExit("operator upload checksum mismatch")
        os.lseek(source_fd, 0, os.SEEK_SET)

        destination_fd = os.open(
            artifact_name,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
            0o600,
            dir_fd=incoming_fd,
        )
        try:
            while True:
                chunk = os.read(source_fd, 1024 * 1024)
                if not chunk:
                    break
                view = memoryview(chunk)
                while view:
                    view = view[os.write(destination_fd, view):]
            os.fchmod(destination_fd, 0o600)
            os.fchown(destination_fd, account.pw_uid, group_entry.gr_gid)
            os.fsync(destination_fd)
            destination_st = os.fstat(destination_fd)
            path_st = os.stat(
                artifact_name, dir_fd=incoming_fd, follow_symlinks=False
            )
            if (path_st.st_dev, path_st.st_ino) != (
                destination_st.st_dev,
                destination_st.st_ino,
            ):
                raise SystemExit("incoming artifact changed during copy")
        except BaseException:
            try:
                path_st = os.stat(
                    artifact_name, dir_fd=incoming_fd, follow_symlinks=False
                )
                destination_st = os.fstat(destination_fd)
                if (path_st.st_dev, path_st.st_ino) == (
                    destination_st.st_dev,
                    destination_st.st_ino,
                ):
                    os.unlink(artifact_name, dir_fd=incoming_fd)
            except FileNotFoundError:
                pass
            raise
        finally:
            os.close(destination_fd)
            destination_fd = None

        uploaded_st = os.stat(
            source_name, dir_fd=source_parent_fd, follow_symlinks=False
        )
        if (uploaded_st.st_dev, uploaded_st.st_ino) != (
            source_st.st_dev,
            source_st.st_ino,
        ):
            raise SystemExit("operator upload changed before cleanup")
        os.unlink(source_name, dir_fd=source_parent_fd)
    finally:
        os.close(source_fd)
finally:
    if destination_fd is not None:
        os.close(destination_fd)
    os.close(incoming_fd)
    os.close(source_parent_fd)
PY

cleanup_artifact() {
  sudo -H -u "$DEPLOY_USER" rm -f -- "$ARTIFACT" || true
}
trap cleanup_artifact EXIT
test "$(
  sudo -H -u "$DEPLOY_USER" \
    sha256sum "$ARTIFACT" | cut -d ' ' -f 1
)" = "$ARCHIVE_SHA256"
sudo -H -u "$DEPLOY_USER" \
  /usr/local/libexec/raddad-deploy check \
  --sha "$SHA" --artifact "$ARTIFACT" \
  --config /etc/raddad-deploy.conf
sudo -H -u "$DEPLOY_USER" \
  /usr/local/libexec/raddad-deploy deploy \
  --sha "$SHA" --artifact "$ARTIFACT" \
  --config /etc/raddad-deploy.conf
cleanup_artifact
trap - EXIT
```

Complete production verification and save the run URL, SHA, archive checksum,
helper output, approvers, and cleanup result. When Actions returns, run the
normal workflow on the then-current tested `main` and reconcile the public SHA.
Never create an arbitrary local build, deploy an artifact from a pull request or
other branch, copy a repository clone into a web root, or weaken SSH checks as
an outage workaround.
