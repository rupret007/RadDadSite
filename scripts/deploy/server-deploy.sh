#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

LOCK_HELD=0
LOCK_DIR=""
STAGING_DIR=""
HEALTH_TEMP=""
ACTIVATION_PENDING=0
ACTIVATION_CANDIDATE_SHA=""
SAFE_PREVIOUS_SHA=""
LAST_RESTORE_RESULT=""
CLEANUP_RUNNING=0
RETENTION_TEMP=""

# Reuse the runbook's representative non-disclosure probes during every
# activation and rollback health check.
PUBLIC_FORBIDDEN_PATHS=(
    ".git/HEAD"
    ".github/workflows/test.yml"
    ".openai/hosting.json"
    ".env"
    "README.md"
    "package.json"
    "package-lock.json"
    "scripts/build-sites.mjs"
    "tests/e2e/homepage.spec.js"
    "test-results/"
    "node_modules/"
    "GPT/"
    "backup_restore_point/index.html"
    "worker/index.js"
    "RadDad_OnePage_Site.zip"
    "RadDad_OnePage_Site_v2.zip"
    "RadDad_OnePage_Site_v3.zip"
    "RadDad_OnePage_Site_v4.zip"
    "RadDad_Website.zip"
)

log() {
    printf '[raddad-deploy] %s\n' "$*"
}

fail() {
    printf '[raddad-deploy] ERROR: %s\n' "$*" >&2
    exit 1
}

usage() {
    cat <<'EOF'
Usage:
  server-deploy.sh check    --sha <40-char-sha> --artifact <archive> [--config <file>]
  server-deploy.sh prepare  --sha <40-char-sha> --artifact <archive> [--config <file>]
  server-deploy.sh deploy   --sha <40-char-sha> --artifact <archive> [--config <file>]
  server-deploy.sh rollback --sha <40-char-sha> [--config <file>]
  server-deploy.sh list     [--config <file>]

Modes:
  check       Validate configuration, layout, and an artifact without changing releases.
  prepare     Install a verified release without changing the current symlink.
  deploy      Install a verified artifact, atomically activate it, and health-check it.
  rollback    Atomically activate a retained release recorded as known-good.
  list        Show retained releases and their known-good/current status.
EOF
}

# shellcheck disable=SC2317,SC2329 # Invoked indirectly by the EXIT trap.
cleanup() {
    local status=$?

    if [[ "$CLEANUP_RUNNING" == "1" ]]; then
        exit "$status"
    fi
    CLEANUP_RUNNING=1
    trap - EXIT
    trap '' HUP INT TERM PIPE
    set +e

    if [[ "$ACTIVATION_PENDING" == "1" ]] &&
       declare -F restore_activation_after_failure >/dev/null 2>&1; then
        if ! restore_activation_after_failure "abnormal helper exit (status $status)"; then
            log "ERROR: abnormal exit could not safely restore production state." >&2
        fi
    fi

    if [[ -n "$HEALTH_TEMP" && -n "${STAGING_ROOT:-}" ]]; then
        python3 - "$STAGING_ROOT" "$HEALTH_TEMP" <<'PY' || true
import os
import re
import sys

staging_root, candidate = sys.argv[1:]
name = os.path.basename(candidate)
if (
    os.path.dirname(candidate) == staging_root
    and re.fullmatch(r"\.health\.[0-9a-f]{40}\.[A-Za-z0-9]+", name)
    and os.path.isfile(candidate)
    and not os.path.islink(candidate)
):
    os.unlink(candidate)
PY
        HEALTH_TEMP=""
    fi

    if [[ -n "$STAGING_DIR" && -e "$STAGING_DIR" ]]; then
        python3 - "$RADDAD_RELEASE_ROOT" "$STAGING_DIR" <<'PY' || true
import os
import re
import shutil
import sys

root, candidate = sys.argv[1:]
staging_root = os.path.join(root, ".staging")
name = os.path.basename(candidate)

if (
    os.path.dirname(candidate) == staging_root
    and re.fullmatch(r"[0-9a-f]{40}\.[A-Za-z0-9]+", name)
    and os.path.isdir(candidate)
    and not os.path.islink(candidate)
):
    shutil.rmtree(candidate)
PY
    fi

    if [[ -n "$RETENTION_TEMP" && -n "${STAGING_ROOT:-}" ]]; then
        python3 - "$STAGING_ROOT" "$RETENTION_TEMP" <<'PY' || true
import os
import re
import sys

staging_root, candidate = sys.argv[1:]
name = os.path.basename(candidate)
if (
    os.path.dirname(candidate) == staging_root
    and re.fullmatch(r"\.retention\.[A-Za-z0-9]+", name)
    and os.path.isfile(candidate)
    and not os.path.islink(candidate)
):
    os.unlink(candidate)
PY
        RETENTION_TEMP=""
    fi

    if [[ "$LOCK_HELD" == "1" && -n "$LOCK_DIR" ]]; then
        rm -f -- "$LOCK_DIR/owner"
        rmdir -- "$LOCK_DIR" 2>/dev/null || true
    fi

    exit "$status"
}

trap cleanup EXIT

# Ignore follow-on termination signals before EXIT cleanup begins. This keeps a
# second signal from interrupting restoration after the first one is accepted.
# shellcheck disable=SC2317,SC2329 # Invoked indirectly by the signal traps.
handle_signal() {
    local status="$1"

    trap '' HUP INT TERM PIPE
    exit "$status"
}

trap 'handle_signal 129' HUP
trap 'handle_signal 130' INT
trap 'handle_signal 143' TERM

MODE="${1:-}"
if [[ -z "$MODE" || "$MODE" == "-h" || "$MODE" == "--help" ]]; then
    usage
    [[ -n "$MODE" ]] && exit 0
    exit 2
fi
shift

case "$MODE" in
    check|prepare|deploy|rollback|list)
        ;;
    *)
        usage >&2
        fail "Unsupported mode: $MODE"
        ;;
esac

EXPECTED_SHA=""
ARTIFACT_PATH=""
CONFIG_PATH="/etc/raddad-deploy.conf"

while (($#)); do
    case "$1" in
        --sha)
            (($# >= 2)) || fail "--sha requires a value."
            EXPECTED_SHA="$2"
            shift 2
            ;;
        --artifact)
            (($# >= 2)) || fail "--artifact requires a value."
            ARTIFACT_PATH="$2"
            shift 2
            ;;
        --config)
            (($# >= 2)) || fail "--config requires a value."
            CONFIG_PATH="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            fail "Unknown argument: $1"
            ;;
    esac
done

[[ "$CONFIG_PATH" == /* ]] ||
    fail "--config must be an absolute path."
[[ -f "$CONFIG_PATH" && ! -L "$CONFIG_PATH" && -r "$CONFIG_PATH" ]] ||
    fail "Config must be a readable regular file, not a symlink: $CONFIG_PATH"
python3 - "$CONFIG_PATH" <<'PY' ||
import os
import stat
import sys

path = sys.argv[1]
details = os.lstat(path)
if details.st_uid not in (0, os.geteuid()):
    raise SystemExit("config owner must be root or the deployment user")
if details.st_mode & (stat.S_IWGRP | stat.S_IWOTH):
    raise SystemExit("config must not be group- or world-writable")
PY
    fail "Config ownership or permissions are unsafe: $CONFIG_PATH"

if [[ "$MODE" == "list" ]]; then
    [[ -z "$EXPECTED_SHA" && -z "$ARTIFACT_PATH" ]] ||
        fail "list does not accept --sha or --artifact."
else
    [[ "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]] ||
        fail "--sha must be an exact 40-character lowercase Git commit SHA."
fi

if [[ "$MODE" == "rollback" || "$MODE" == "list" ]]; then
    [[ -z "$ARTIFACT_PATH" ]] ||
        fail "$MODE does not accept --artifact."
else
    [[ -n "$ARTIFACT_PATH" ]] ||
        fail "$MODE requires --artifact."
    [[ "$ARTIFACT_PATH" == /* ]] ||
        fail "--artifact must be an absolute path."
fi

load_config() {
    local raw key value

    while IFS= read -r raw || [[ -n "$raw" ]]; do
        raw="${raw%$'\r'}"

        [[ "$raw" =~ ^[[:space:]]*$ ]] && continue
        [[ "$raw" =~ ^[[:space:]]*# ]] && continue
        [[ "$raw" =~ ^([A-Z][A-Z0-9_]*)=([A-Za-z0-9:/._-]+)$ ]] ||
            fail "Invalid config line; use unquoted KEY=value with no spaces."

        key="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"

        case "$key" in
            RADDAD_RELEASE_ROOT)
                RADDAD_RELEASE_ROOT="$value"
                ;;
            RADDAD_SITE_URL)
                RADDAD_SITE_URL="$value"
                ;;
            RADDAD_RETENTION_COUNT)
                RADDAD_RETENTION_COUNT="$value"
                ;;
            RADDAD_HEALTH_ATTEMPTS)
                RADDAD_HEALTH_ATTEMPTS="$value"
                ;;
            RADDAD_HEALTH_DELAY_SECONDS)
                RADDAD_HEALTH_DELAY_SECONDS="$value"
                ;;
            *)
                fail "Unknown config key: $key"
                ;;
        esac
    done < "$CONFIG_PATH"
}

unset \
    RADDAD_RELEASE_ROOT \
    RADDAD_SITE_URL \
    RADDAD_RETENTION_COUNT \
    RADDAD_HEALTH_ATTEMPTS \
    RADDAD_HEALTH_DELAY_SECONDS
load_config

: "${RADDAD_RETENTION_COUNT:=5}"
: "${RADDAD_HEALTH_ATTEMPTS:=5}"
: "${RADDAD_HEALTH_DELAY_SECONDS:=2}"

[[ "${RADDAD_RELEASE_ROOT:-}" =~ ^/[A-Za-z0-9._/-]+$ ]] ||
    fail "RADDAD_RELEASE_ROOT must be a simple absolute path."
[[ "$RADDAD_RELEASE_ROOT" != "/" &&
   "$RADDAD_RELEASE_ROOT" != "/srv" &&
   "$RADDAD_RELEASE_ROOT" != "/var" &&
   "$RADDAD_RELEASE_ROOT" != "/home" &&
   "$RADDAD_RELEASE_ROOT" != "/root" &&
   "$RADDAD_RELEASE_ROOT" != "/usr" &&
   "$RADDAD_RELEASE_ROOT" != "/tmp" &&
   "$RADDAD_RELEASE_ROOT" != *"/../"* &&
   "$RADDAD_RELEASE_ROOT" != *"/./"* &&
   "$RADDAD_RELEASE_ROOT" != *"//"* &&
   "$RADDAD_RELEASE_ROOT" != */ ]] ||
    fail "RADDAD_RELEASE_ROOT is too broad or contains traversal."
[[ "${RADDAD_SITE_URL:-}" =~ ^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?/?$ ]] ||
    fail "RADDAD_SITE_URL must be an HTTPS origin with no path, query, or credentials."
RADDAD_SITE_URL="${RADDAD_SITE_URL%/}"
if [[ ! "$RADDAD_RETENTION_COUNT" =~ ^[0-9]+$ ]] ||
    ((RADDAD_RETENTION_COUNT < 2 || RADDAD_RETENTION_COUNT > 20)); then
    fail "RADDAD_RETENTION_COUNT must be between 2 and 20."
fi
if [[ ! "$RADDAD_HEALTH_ATTEMPTS" =~ ^[0-9]+$ ]] ||
    ((RADDAD_HEALTH_ATTEMPTS < 1 || RADDAD_HEALTH_ATTEMPTS > 20)); then
    fail "RADDAD_HEALTH_ATTEMPTS must be between 1 and 20."
fi
if [[ ! "$RADDAD_HEALTH_DELAY_SECONDS" =~ ^[0-9]+$ ]] ||
    ((RADDAD_HEALTH_DELAY_SECONDS > 60)); then
    fail "RADDAD_HEALTH_DELAY_SECONDS must be between 0 and 60."
fi

command -v python3 >/dev/null 2>&1 ||
    fail "python3 is required on the production server."

RELEASES_DIR="$RADDAD_RELEASE_ROOT/releases"
STAGING_ROOT="$RADDAD_RELEASE_ROOT/.staging"
CURRENT_LINK="$RADDAD_RELEASE_ROOT/current"
LOCK_DIR="$RADDAD_RELEASE_ROOT/.deploy.lock"
KNOWN_GOOD_FILE="$RADDAD_RELEASE_ROOT/.known-good"

validate_layout() {
    python3 - "$RADDAD_RELEASE_ROOT" "${HOME:-}" "$KNOWN_GOOD_FILE" "$MODE" <<'PY'
import os
import re
import stat
import sys

root, home, known_good, mode = sys.argv[1:]
euid = os.geteuid()
sha_pattern = re.compile(r"[0-9a-f]{40}")

def stop(message):
    raise SystemExit(message)

def require_owned_directory(path, label):
    try:
        details = os.lstat(path)
    except FileNotFoundError:
        stop(f"{label} must be a pre-created directory")
    if not stat.S_ISDIR(details.st_mode) or stat.S_ISLNK(details.st_mode):
        stop(f"{label} must be a pre-created real directory")
    if details.st_uid != euid:
        stop(f"{label} must be owned by the deployment user")
    if details.st_mode & (stat.S_IWGRP | stat.S_IWOTH):
        stop(f"{label} must not be group- or world-writable")
    if os.path.realpath(path) != path:
        stop(f"{label} or one of its parents resolves through a symlink")
    if not os.access(path, os.W_OK | os.X_OK):
        stop(f"{label} is not writable by the deployment user")

if os.path.normpath(root) != root:
    stop("release root is not normalized")
if home:
    home = os.path.realpath(home)
    resolved_candidate = os.path.realpath(root)
    try:
        if os.path.commonpath([home, resolved_candidate]) == home:
            stop("release root must not be the deployment user's home directory")
    except ValueError:
        pass
require_owned_directory(root, "release root")

releases = os.path.join(root, "releases")
staging = os.path.join(root, ".staging")
for path, label in ((releases, "releases"), (staging, "staging")):
    require_owned_directory(path, label)

current = os.path.join(root, "current")
if os.path.lexists(current):
    if not os.path.islink(current):
        if mode != "list":
            stop("current must be a symlink")
    else:
        current_details = os.lstat(current)
        if current_details.st_uid != euid:
            stop("current symlink must be owned by the deployment user")
        raw_target = os.readlink(current)
        target = os.path.normpath(
            raw_target if os.path.isabs(raw_target) else os.path.join(root, raw_target)
        )
        direct_release = (
            os.path.dirname(target) == releases
            and sha_pattern.fullmatch(os.path.basename(target))
        )
        if not direct_release and mode not in ("list", "rollback"):
            stop("current must point directly to one versioned release path")

lock = os.path.join(root, ".deploy.lock")
if os.path.lexists(lock):
    details = os.lstat(lock)
    if not stat.S_ISDIR(details.st_mode) or stat.S_ISLNK(details.st_mode):
        stop("deployment lock path exists but is not a real directory")
    if details.st_uid != euid or details.st_mode & (stat.S_IWGRP | stat.S_IWOTH):
        stop("deployment lock ownership or permissions are unsafe")

if os.path.lexists(known_good):
    details = os.lstat(known_good)
    if not stat.S_ISREG(details.st_mode) or stat.S_ISLNK(details.st_mode):
        stop("known-good state must be a regular file, not a symlink")
    if details.st_uid != euid:
        stop("known-good state must be owned by the deployment user")
    if stat.S_IMODE(details.st_mode) != 0o600:
        stop("known-good state must have mode 0600")
    try:
        lines = open(known_good, encoding="ascii").read().splitlines()
    except (OSError, UnicodeDecodeError) as error:
        stop(f"known-good state is unreadable: {error}")
    if len(lines) > 1000 or len(lines) != len(set(lines)):
        stop("known-good state contains too many or duplicate entries")
    if any(not sha_pattern.fullmatch(line) for line in lines):
        stop("known-good state contains an invalid release identifier")
PY
}

validate_layout || fail "Server release layout validation failed."

validate_source() {
    local source_kind="$1"
    local source_path="$2"
    local expected_sha="$3"
    local extract_path="${4:-}"

    python3 - "$source_kind" "$source_path" "$expected_sha" "$extract_path" <<'PY'
import hashlib
import json
import os
from pathlib import PurePosixPath
import re
import stat
import sys
import tarfile

kind, source, expected_sha, extract_root = sys.argv[1:]
MAX_FILE_BYTES = 64 * 1024 * 1024
MAX_TOTAL_BYTES = 128 * 1024 * 1024
MAX_FILES = 1000
CURRENT_PRODUCTION_FILES = {
    "RadDad_Logo.jpg",
    "SHA256SUMS",
    "artifact-manifest.json",
    "assets/rad-dad-friends-guitars-growlers-2026-1122.webp",
    "assets/rad-dad-friends-guitars-growlers-2026-561.webp",
    "assets/rad-dad-friends-guitars-growlers-2026-v2-1024.webp",
    "assets/rad-dad-friends-guitars-growlers-2026-v2-512.webp",
    "assets/rad-dad-friends-guitars-growlers-2026-v2-full.png",
    "assets/rad-dad-friends-guitars-growlers-2026-full.png",
    "assets/rad-dad-friends-guitars-growlers-2026.ics",
    "assets/rad-dad-social-2026-v2.png",
    "assets/rad-dad-social-2026.png",
    "assets/rad-dad-tap-og.png",
    "assets/story-of-us-cassette-render.webp",
    "assets/story-of-us-cover.webp",
    "assets/the-middle-jimmy-eat-world-thumbnail.webp",
    "assets/wildflower-2026-poster-720.webp",
    "assets/wildflower-she-green-day.webp",
    "index.html",
    "nfc/index.html",
    "qr/index.html",
    "qr/script.js",
    "qr/styles.css",
    "script.js",
    "show-state.js",
    "styles.css",
    "tap/index.html",
    "version.json",
}
RETAINED_REQUIRED_FILES = {
    "RadDad_Logo.jpg",
    "SHA256SUMS",
    "artifact-manifest.json",
    "index.html",
    "script.js",
    "styles.css",
    "version.json",
}
RETAINED_ASSET_EXTENSIONS = {
    ".avif", ".gif", ".ico", ".ics", ".jpeg", ".jpg", ".png",
    ".svg", ".webp", ".woff", ".woff2",
}
RETAINED_ROUTE_FILES = {
    "nfc/index.html",
    "qr/index.html",
    "qr/script.js",
    "qr/styles.css",
    "show-state.js",
    "tap/index.html",
}
REQUIRED_FILES = (
    CURRENT_PRODUCTION_FILES if kind == "archive" else RETAINED_REQUIRED_FILES
)
SHA_RE = re.compile(r"[0-9a-f]{40}")
HASH_RE = re.compile(r"[0-9a-f]{64}")
TIMESTAMP_RE = re.compile(
    r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z"
)

def stop(message):
    raise SystemExit(message)

def canonical_path(raw_name):
    name = raw_name
    while name.startswith("./"):
        name = name[2:]
    if name in ("", "."):
        return None
    if name.startswith("/") or "\\" in name:
        stop(f"unsafe absolute or backslash path: {raw_name}")
    path = PurePosixPath(name)
    if any(part in ("", ".", "..") or part.startswith(".") for part in path.parts):
        stop(f"unsafe dot or traversal path: {raw_name}")
    return str(path)

def allowed_file(path):
    if kind == "archive":
        return path in CURRENT_PRODUCTION_FILES
    if path in RETAINED_REQUIRED_FILES:
        return True
    if path in RETAINED_ROUTE_FILES:
        return True
    return (
        re.fullmatch(r"assets/[A-Za-z0-9][A-Za-z0-9._-]*", path) is not None
        and PurePosixPath(path).suffix.lower() in RETAINED_ASSET_EXTENSIONS
    )

def allowed_directory(path):
    return path in {"assets", "nfc", "qr", "tap"}

def read_directory(path):
    if not os.path.isabs(path):
        stop("release directory must be absolute")
    if not os.path.isdir(path) or os.path.islink(path):
        stop("release directory must be a real directory")
    root_details = os.lstat(path)
    if root_details.st_uid != os.geteuid():
        stop("release directory must be owned by the deployment user")
    if root_details.st_mode & (stat.S_IWGRP | stat.S_IWOTH):
        stop("release directory must not be group- or world-writable")

    files = {}
    directories = set()
    total_bytes = 0

    def visit(directory, relative_prefix=""):
        nonlocal total_bytes
        for entry in os.scandir(directory):
            relative = f"{relative_prefix}/{entry.name}" if relative_prefix else entry.name
            canonical = canonical_path(relative)
            details = entry.stat(follow_symlinks=False)
            if details.st_uid != os.geteuid():
                stop(f"release entry has the wrong owner: {canonical}")
            if details.st_mode & (stat.S_IWGRP | stat.S_IWOTH):
                stop(f"release entry is group- or world-writable: {canonical}")
            if stat.S_ISLNK(details.st_mode):
                stop(f"symlink is forbidden: {relative}")
            if stat.S_ISDIR(details.st_mode):
                if not allowed_directory(canonical):
                    stop(f"unexpected directory: {canonical}")
                directories.add(canonical)
                visit(entry.path, canonical)
            elif stat.S_ISREG(details.st_mode):
                if not allowed_file(canonical):
                    stop(f"unexpected production file: {canonical}")
                if details.st_size > MAX_FILE_BYTES:
                    stop(f"file exceeds safety limit: {canonical}")
                with open(entry.path, "rb") as handle:
                    files[canonical] = handle.read(MAX_FILE_BYTES + 1)
                if len(files[canonical]) != details.st_size:
                    stop(f"could not read complete file: {canonical}")
                total_bytes += len(files[canonical])
                if total_bytes > MAX_TOTAL_BYTES:
                    stop("release exceeds the total uncompressed safety limit")
            else:
                stop(f"special filesystem entry is forbidden: {canonical}")

    visit(path)
    return files, directories

def read_archive(path):
    if not os.path.isabs(path):
        stop("artifact path must be absolute")
    parent = os.path.dirname(path)
    parent_details = os.lstat(parent)
    if (
        not stat.S_ISDIR(parent_details.st_mode)
        or stat.S_ISLNK(parent_details.st_mode)
        or os.path.realpath(parent) != parent
    ):
        stop("artifact parent must be a real directory")
    if parent_details.st_uid != os.geteuid():
        stop("artifact parent must be owned by the deployment user")
    if parent_details.st_mode & (stat.S_IWGRP | stat.S_IWOTH):
        stop("artifact parent must not be group- or world-writable")
    details = os.lstat(path)
    if not stat.S_ISREG(details.st_mode):
        stop("artifact must be a regular file, not a symlink")
    if details.st_uid != os.geteuid():
        stop("artifact must be owned by the deployment user")
    if details.st_mode & (stat.S_IWGRP | stat.S_IWOTH):
        stop("artifact must not be group- or world-writable")
    if details.st_size > MAX_TOTAL_BYTES:
        stop("compressed artifact exceeds the safety limit")
    if os.path.realpath(path) != os.path.normpath(path):
        stop("artifact path or one of its parents resolves through a symlink")

    files = {}
    directories = set()
    seen = set()
    total_bytes = 0

    try:
        archive = tarfile.open(path, mode="r:gz")
    except (OSError, tarfile.TarError) as error:
        stop(f"artifact is not a readable gzip tar archive: {error}")

    with archive:
        entry_count = 0
        for member in archive:
            entry_count += 1
            if entry_count > MAX_FILES * 2:
                stop("artifact contains too many entries")
            canonical = canonical_path(member.name)
            if canonical is None:
                if not member.isdir():
                    stop("artifact root entry must be a directory")
                continue
            if canonical in seen:
                stop(f"duplicate archive path: {canonical}")
            seen.add(canonical)

            if member.isdir():
                if not allowed_directory(canonical):
                    stop(f"unexpected directory: {canonical}")
                directories.add(canonical)
                continue
            if not member.isfile():
                stop(f"links and special archive entries are forbidden: {canonical}")
            if not allowed_file(canonical):
                stop(f"unexpected production file: {canonical}")
            if member.size < 0 or member.size > MAX_FILE_BYTES:
                stop(f"file exceeds safety limit: {canonical}")

            handle = archive.extractfile(member)
            if handle is None:
                stop(f"could not read archive member: {canonical}")
            data = handle.read(MAX_FILE_BYTES + 1)
            if len(data) != member.size:
                stop(f"archive member length mismatch: {canonical}")
            total_bytes += len(data)
            if total_bytes > MAX_TOTAL_BYTES:
                stop("artifact exceeds the total uncompressed safety limit")
            files[canonical] = data

    return files, directories

def parse_json_file(files, path):
    data = files[path]
    if len(data) > 1024 * 1024:
        stop(f"{path} is unexpectedly large")
    try:
        return json.loads(data.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        stop(f"{path} is not valid UTF-8 JSON: {error}")

if kind == "archive":
    files, directories = read_archive(source)
elif kind == "directory":
    if extract_root:
        stop("directory verification cannot extract")
    files, directories = read_directory(source)
else:
    stop(f"unsupported validation source: {kind}")

if len(files) > MAX_FILES:
    stop("artifact contains too many files")
if sum(len(data) for data in files.values()) > MAX_TOTAL_BYTES:
    stop("artifact exceeds the total uncompressed safety limit")
missing = sorted(REQUIRED_FILES - set(files))
if missing:
    stop(f"artifact is missing required files: {', '.join(missing)}")

version = parse_json_file(files, "version.json")
if (
    not isinstance(version, dict)
    or set(version) != {"commitSha", "timestamp"}
    or version.get("commitSha") != expected_sha
    or not SHA_RE.fullmatch(str(version.get("commitSha", "")))
    or not TIMESTAMP_RE.fullmatch(str(version.get("timestamp", "")))
):
    stop("version.json does not identify the exact expected release")

manifest = parse_json_file(files, "artifact-manifest.json")
if not isinstance(manifest, dict) or set(manifest) != {
    "artifactRoot", "commitSha", "files", "schemaVersion", "timestamp"
}:
    stop("artifact-manifest.json has unexpected or missing fields")
if (
    manifest["schemaVersion"] != 1
    or manifest["artifactRoot"] != "dist/client"
    or manifest["commitSha"] != expected_sha
    or manifest["timestamp"] != version["timestamp"]
    or not isinstance(manifest["files"], list)
):
    stop("artifact-manifest.json identity or schema is invalid")

payload_paths = sorted(set(files) - {"artifact-manifest.json", "SHA256SUMS"})
manifest_paths = []
for entry in manifest["files"]:
    if not isinstance(entry, dict) or set(entry) != {"bytes", "path", "sha256"}:
        stop("artifact manifest file entry has unexpected or missing fields")
    path = canonical_path(str(entry["path"]))
    if path != entry["path"] or not allowed_file(path):
        stop(f"artifact manifest contains an unsafe path: {entry['path']}")
    if (
        isinstance(entry["bytes"], bool)
        or not isinstance(entry["bytes"], int)
        or entry["bytes"] < 0
        or not isinstance(entry["sha256"], str)
        or not HASH_RE.fullmatch(entry["sha256"])
    ):
        stop(f"artifact manifest metadata is invalid for {path}")
    if path not in files:
        stop(f"artifact manifest references a missing file: {path}")
    digest = hashlib.sha256(files[path]).hexdigest()
    if entry["bytes"] != len(files[path]) or entry["sha256"] != digest:
        stop(f"artifact manifest verification failed for {path}")
    manifest_paths.append(path)

if manifest_paths != payload_paths:
    stop("artifact manifest paths must be complete, unique, and sorted")

checksum_bytes = files["SHA256SUMS"]
try:
    checksum_text = checksum_bytes.decode("ascii")
except UnicodeDecodeError:
    stop("SHA256SUMS must contain ASCII")
if not checksum_text.endswith("\n"):
    stop("SHA256SUMS must end with a newline")

checksum_entries = {}
for line in checksum_text[:-1].split("\n"):
    match = re.fullmatch(r"([0-9a-f]{64})  ([^\r\n]+)", line)
    if not match:
        stop(f"malformed SHA256SUMS line: {line}")
    digest, raw_path = match.groups()
    path = canonical_path(raw_path)
    if path != raw_path or path == "SHA256SUMS" or path in checksum_entries:
        stop(f"unsafe or duplicate SHA256SUMS path: {raw_path}")
    checksum_entries[path] = digest

expected_checksum_paths = sorted(set(files) - {"SHA256SUMS"})
if sorted(checksum_entries) != expected_checksum_paths:
    stop("SHA256SUMS must list every other artifact file exactly once")
for path in expected_checksum_paths:
    if hashlib.sha256(files[path]).hexdigest() != checksum_entries[path]:
        stop(f"SHA256SUMS verification failed for {path}")

if extract_root:
    if kind != "archive":
        stop("only an archive can be extracted")
    if not os.path.isdir(extract_root) or os.path.islink(extract_root):
        stop("extraction target must be a real directory")
    if os.listdir(extract_root):
        stop("extraction target must be empty")

    for path in sorted(directories):
        destination = os.path.join(extract_root, *PurePosixPath(path).parts)
        os.makedirs(destination, mode=0o755, exist_ok=True)
        os.chmod(destination, 0o755)
    for path, data in sorted(files.items()):
        destination = os.path.join(extract_root, *PurePosixPath(path).parts)
        os.makedirs(os.path.dirname(destination), mode=0o755, exist_ok=True)
        descriptor = os.open(
            destination,
            os.O_WRONLY | os.O_CREAT | os.O_EXCL,
            0o644,
        )
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
        os.chmod(destination, 0o644)

print(
    f"verified {len(files)} files for {expected_sha}"
    + (" and extracted safely" if extract_root else "")
)
PY
}

current_snapshot() {
    python3 - "$CURRENT_LINK" "$RADDAD_RELEASE_ROOT" "$RELEASES_DIR" <<'PY'
import hashlib
import os
import re
import stat
import sys

current, root, releases = sys.argv[1:]
if not os.path.lexists(current):
    print("absent")
    raise SystemExit(0)
details = os.lstat(current)
if not stat.S_ISLNK(details.st_mode):
    print(f"unsafe:{details.st_dev}:{details.st_ino}:{details.st_mode}:{details.st_uid}")
    raise SystemExit(0)
raw_target = os.readlink(current)
target = os.path.normpath(
    raw_target if os.path.isabs(raw_target) else os.path.join(root, raw_target)
)
identity = f"{details.st_dev}:{details.st_ino}:{details.st_uid}"
if os.path.dirname(target) == releases and re.fullmatch(
    r"[0-9a-f]{40}", os.path.basename(target)
):
    print(f"direct:{os.path.basename(target)}:{identity}")
else:
    digest = hashlib.sha256(os.fsencode(raw_target)).hexdigest()
    print(f"invalid:{identity}:{digest}")
PY
}

snapshot_sha() {
    local snapshot="$1"
    local value

    case "$snapshot" in
        direct:*)
            value="${snapshot#direct:}"
            printf '%s\n' "${value%%:*}"
            ;;
        *)
            printf '\n'
            ;;
    esac
}

snapshot_label() {
    local snapshot="$1"

    case "$snapshot" in
        absent)
            printf 'none\n'
            ;;
        direct:*)
            snapshot_sha "$snapshot"
            ;;
        invalid:*)
            printf 'invalid-symlink\n'
            ;;
        *)
            printf 'unsafe-current\n'
            ;;
    esac
}

is_known_good() {
    local sha="$1"

    python3 - "$KNOWN_GOOD_FILE" "$sha" <<'PY'
import os
import sys

path, sha = sys.argv[1:]
if not os.path.exists(path):
    raise SystemExit(1)
with open(path, encoding="ascii") as handle:
    entries = handle.read().splitlines()
raise SystemExit(0 if sha in entries else 1)
PY
}

record_known_good() {
    local sha="$1"

    python3 - "$RADDAD_RELEASE_ROOT" "$KNOWN_GOOD_FILE" "$sha" <<'PY'
import os
import re
import stat
import sys
import tempfile

root, state_path, sha = sys.argv[1:]
euid = os.geteuid()
if not re.fullmatch(r"[0-9a-f]{40}", sha):
    raise SystemExit("refusing invalid known-good release identifier")

entries = []
if os.path.exists(state_path):
    details = os.lstat(state_path)
    if (
        not stat.S_ISREG(details.st_mode)
        or stat.S_ISLNK(details.st_mode)
        or details.st_uid != euid
        or stat.S_IMODE(details.st_mode) != 0o600
    ):
        raise SystemExit("known-good state ownership or permissions are unsafe")
    with open(state_path, encoding="ascii") as handle:
        entries = handle.read().splitlines()

entries = [sha, *(entry for entry in entries if entry != sha)]
descriptor, temporary = tempfile.mkstemp(prefix=".known-good.", dir=root)
try:
    os.fchmod(descriptor, 0o600)
    with os.fdopen(descriptor, "w", encoding="ascii") as handle:
        handle.write("".join(f"{entry}\n" for entry in entries))
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, state_path)
    os.chmod(state_path, 0o600)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
PY
}

list_releases() {
    local current="$1"
    local current_label="$2"
    local sha recorded active installed status position

    printf 'CURRENT\t%s\n' "$current_label"
    while IFS=$'\t' read -r sha recorded active installed; do
        status="BROKEN"
        if [[ "$installed" == "1" ]] &&
           validate_source directory "$RELEASES_DIR/$sha" "$sha" >/dev/null 2>&1; then
            if [[ "$recorded" == "1" ]]; then
                status="HEALTHY"
            else
                status="INSTALLED-UNHEALTHY"
            fi
        fi
        position="INACTIVE"
        [[ "$active" != "1" ]] || position="CURRENT"
        printf '%s\t%s\t%s\n' "$sha" "$status" "$position"
    done < <(
        python3 - "$RELEASES_DIR" "$KNOWN_GOOD_FILE" "$current" <<'PY'
import os
import re
import stat
import sys

releases, state_path, current = sys.argv[1:]
sha_pattern = re.compile(r"[0-9a-f]{40}")

known = []
if os.path.exists(state_path):
    with open(state_path, encoding="ascii") as handle:
        known = handle.read().splitlines()

installed = {}
for entry in os.scandir(releases):
    details = entry.stat(follow_symlinks=False)
    if (
        sha_pattern.fullmatch(entry.name)
        and stat.S_ISDIR(details.st_mode)
        and not entry.is_symlink()
    ):
        installed[entry.name] = entry.path

ordered = [*known]
ordered.extend(sorted(set(installed) - set(known)))
if current and current not in ordered:
    ordered.append(current)

for sha in ordered:
    print(
        "\t".join(
            (
                sha,
                "1" if sha in known else "0",
                "1" if sha == current else "0",
                "1" if sha in installed else "0",
            )
        )
    )
PY
    )
}

acquire_lock() {
    if ! mkdir -m 700 -- "$LOCK_DIR" 2>/dev/null; then
        fail "Another deployment is active, or the lock requires operator inspection: $LOCK_DIR"
    fi
    LOCK_HELD=1
    {
        printf 'pid=%s\n' "$$"
        printf 'mode=%s\n' "$MODE"
        printf 'sha=%s\n' "$EXPECTED_SHA"
        printf 'started=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    } > "$LOCK_DIR/owner"
}

atomic_activate() {
    local sha="$1"
    local expected_current_snapshot="$2"

    python3 - "$RADDAD_RELEASE_ROOT" "$sha" "$expected_current_snapshot" <<'PY'
import hashlib
import os
import re
import stat
import sys

root, sha, expected_snapshot = sys.argv[1:]
if not re.fullmatch(r"[0-9a-f]{40}", sha):
    raise SystemExit("refusing unsafe release identifier")
release = os.path.join(root, "releases", sha)
if not os.path.isdir(release) or os.path.islink(release):
    raise SystemExit("release target is not a real directory")
current = os.path.join(root, "current")
releases = os.path.join(root, "releases")

def snapshot():
    if not os.path.lexists(current):
        return "absent"
    details = os.lstat(current)
    if not stat.S_ISLNK(details.st_mode):
        return f"unsafe:{details.st_dev}:{details.st_ino}:{details.st_mode}:{details.st_uid}"
    raw_target = os.readlink(current)
    target = os.path.normpath(
        raw_target if os.path.isabs(raw_target) else os.path.join(root, raw_target)
    )
    identity = f"{details.st_dev}:{details.st_ino}:{details.st_uid}"
    if os.path.dirname(target) == releases and re.fullmatch(
        r"[0-9a-f]{40}", os.path.basename(target)
    ):
        return f"direct:{os.path.basename(target)}:{identity}"
    digest = hashlib.sha256(os.fsencode(raw_target)).hexdigest()
    return f"invalid:{identity}:{digest}"

if snapshot() != expected_snapshot:
    raise SystemExit("current changed before activation; refusing to overwrite it")
temporary = os.path.join(root, f".current.{os.getpid()}.tmp")
if os.path.lexists(temporary):
    raise SystemExit("temporary current link already exists")
os.symlink(os.path.join("releases", sha), temporary)
try:
    if snapshot() != expected_snapshot:
        raise SystemExit("current changed during activation; refusing to overwrite it")
    os.replace(temporary, current)
finally:
    if os.path.lexists(temporary):
        os.unlink(temporary)
PY
}

restore_current_if_candidate() {
    local candidate="$1"
    local replacement="${2:-}"

    python3 - "$RADDAD_RELEASE_ROOT" "$candidate" "$replacement" <<'PY'
import os
import re
import stat
import sys

root, candidate, replacement = sys.argv[1:]
sha_pattern = re.compile(r"[0-9a-f]{40}")
if not sha_pattern.fullmatch(candidate):
    raise SystemExit("refusing unsafe candidate identifier")
if replacement and not sha_pattern.fullmatch(replacement):
    raise SystemExit("refusing unsafe replacement identifier")

releases = os.path.join(root, "releases")
current = os.path.join(root, "current")

def target_sha():
    if not os.path.lexists(current) or not os.path.islink(current):
        return None
    raw_target = os.readlink(current)
    target = os.path.normpath(
        raw_target if os.path.isabs(raw_target) else os.path.join(root, raw_target)
    )
    if os.path.dirname(target) != releases:
        return None
    value = os.path.basename(target)
    return value if sha_pattern.fullmatch(value) else None

if target_sha() != candidate:
    print("changed")
    raise SystemExit(0)

before = os.lstat(current)
if replacement:
    release = os.path.join(releases, replacement)
    release_details = os.lstat(release)
    if not stat.S_ISDIR(release_details.st_mode) or stat.S_ISLNK(release_details.st_mode):
        raise SystemExit("replacement release is not a real directory")
    temporary = os.path.join(root, f".current.restore.{os.getpid()}.tmp")
    if os.path.lexists(temporary):
        raise SystemExit("temporary restore link already exists")
    os.symlink(os.path.join("releases", replacement), temporary)
    try:
        latest = os.lstat(current)
        if (
            latest.st_dev != before.st_dev
            or latest.st_ino != before.st_ino
            or target_sha() != candidate
        ):
            print("changed")
            raise SystemExit(0)
        os.replace(temporary, current)
        print(f"restored:{replacement}")
    finally:
        if os.path.lexists(temporary):
            os.unlink(temporary)
else:
    latest = os.lstat(current)
    if (
        latest.st_dev != before.st_dev
        or latest.st_ino != before.st_ino
        or target_sha() != candidate
    ):
        print("changed")
        raise SystemExit(0)
    os.unlink(current)
    print("removed")
PY
}

restore_activation_after_failure() {
    local reason="$1"
    local replacement=""

    [[ "$ACTIVATION_PENDING" == "1" ]] || return 0
    log "Activation of $ACTIVATION_CANDIDATE_SHA did not commit: $reason." >&2

    if [[ -n "$SAFE_PREVIOUS_SHA" ]] &&
       validate_source directory \
           "$RELEASES_DIR/$SAFE_PREVIOUS_SHA" \
           "$SAFE_PREVIOUS_SHA" >/dev/null &&
       is_known_good "$SAFE_PREVIOUS_SHA"; then
        replacement="$SAFE_PREVIOUS_SHA"
    elif [[ -n "$SAFE_PREVIOUS_SHA" ]]; then
        log "Prior release $SAFE_PREVIOUS_SHA is no longer valid and will not be restored." >&2
    fi

    if ! LAST_RESTORE_RESULT="$(
        restore_current_if_candidate "$ACTIVATION_CANDIDATE_SHA" "$replacement"
    )"; then
        return 1
    fi
    ACTIVATION_PENDING=0

    case "$LAST_RESTORE_RESULT" in
        restored:*)
            log "Restored known-good release ${LAST_RESTORE_RESULT#restored:}."
            ;;
        removed)
            log "Removed the unverified first-release current link."
            ;;
        changed)
            log "Current changed after activation; refusing to overwrite the concurrent change."
            ;;
        *)
            return 1
            ;;
    esac
}

health_check() {
    local sha="$1"
    local attempt path url_path forbidden_path status_code
    local attempt_ok
    local -a public_paths=()

    command -v curl >/dev/null 2>&1 ||
        fail "curl is required for deployment and rollback health checks."

    while IFS= read -r path; do
        public_paths[${#public_paths[@]}]="$path"
    done < <(
        python3 - "$RELEASES_DIR/$sha" <<'PY'
import os
import sys

root = sys.argv[1]
paths = []
for directory, _, filenames in os.walk(root):
    for filename in filenames:
        absolute = os.path.join(directory, filename)
        paths.append(os.path.relpath(absolute, root).replace(os.sep, "/"))
for path in sorted(paths):
    print(path)
PY
    )
    ((${#public_paths[@]} > 0)) || return 1

    for ((attempt = 1; attempt <= RADDAD_HEALTH_ATTEMPTS; attempt += 1)); do
        attempt_ok=1

        for path in "${public_paths[@]}"; do
            HEALTH_TEMP="$(mktemp "$STAGING_ROOT/.health.${sha}.XXXXXX")"
            url_path="/$path"
            [[ "$path" != "index.html" ]] || url_path="/"

            if ! curl \
                --fail \
                --silent \
                --show-error \
                --proto '=https' \
                --connect-timeout 5 \
                --max-time 15 \
                -H 'Cache-Control: no-cache' \
                --output "$HEALTH_TEMP" \
                "${RADDAD_SITE_URL}${url_path}?v=${sha}"; then
                attempt_ok=0
            elif ! python3 - \
                "$RELEASES_DIR/$sha/$path" \
                "$HEALTH_TEMP" \
                "$sha" \
                "$path" <<'PY'
import hashlib
import json
import re
import sys

expected_path, observed_path, expected_sha, public_path = sys.argv[1:]

def digest(path):
    value = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(block)
    return value.digest()

if digest(expected_path) != digest(observed_path):
    raise SystemExit(f"public bytes differ from verified release: {public_path}")

if public_path == "version.json":
    try:
        with open(observed_path, encoding="utf-8") as handle:
            version = json.load(handle)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        raise SystemExit("public version.json is invalid")
    if not isinstance(version, dict) or version.get("commitSha") != expected_sha:
        raise SystemExit("public version.json reports the wrong commit")

if public_path == "index.html":
    try:
        with open(observed_path, encoding="utf-8") as handle:
            homepage = handle.read()
    except (OSError, UnicodeDecodeError):
        raise SystemExit("public homepage is not valid UTF-8")
    if not re.search(r"<title>[^<]*Rad Dad", homepage, re.IGNORECASE):
        raise SystemExit("public homepage lacks the expected Rad Dad title marker")
PY
            then
                attempt_ok=0
            fi

            rm -f -- "$HEALTH_TEMP"
            HEALTH_TEMP=""
            [[ "$attempt_ok" == "1" ]] || break
        done

        if [[ "$attempt_ok" == "1" ]]; then
            for forbidden_path in "${PUBLIC_FORBIDDEN_PATHS[@]}"; do
                if ! status_code="$(
                    curl \
                        --silent \
                        --show-error \
                        --proto '=https' \
                        --connect-timeout 5 \
                        --max-time 15 \
                        -H 'Cache-Control: no-cache' \
                        --output /dev/null \
                        --write-out '%{http_code}' \
                        "${RADDAD_SITE_URL}/${forbidden_path}?v=${sha}"
                )"; then
                    attempt_ok=0
                    break
                fi

                if [[ "$status_code" != "404" ]]; then
                    log "Forbidden public path $forbidden_path returned HTTP $status_code."
                    attempt_ok=0
                    break
                fi
            done
        fi

        if [[ "$attempt_ok" == "1" ]]; then
            log "Public health check verified every published file and rejected repository-only paths for $sha."
            return 0
        fi

        if ((attempt < RADDAD_HEALTH_ATTEMPTS)); then
            sleep "$RADDAD_HEALTH_DELAY_SECONDS"
        fi
    done

    return 1
}

install_release() {
    local expected_current_snapshot="$1"
    local release_path="$RELEASES_DIR/$EXPECTED_SHA"

    if [[ -e "$release_path" || -L "$release_path" ]]; then
        [[ -d "$release_path" && ! -L "$release_path" ]] ||
            fail "Existing release path is not a real directory: $release_path"
        validate_source directory "$release_path" "$EXPECTED_SHA" ||
            fail "Existing release failed verification; it will not be overwritten."
        log "Using already verified release $EXPECTED_SHA."
        return
    fi

    STAGING_DIR="$(mktemp -d "$STAGING_ROOT/${EXPECTED_SHA}.XXXXXX")"
    validate_source archive "$ARTIFACT_PATH" "$EXPECTED_SHA" "$STAGING_DIR" ||
        fail "Artifact validation or safe extraction failed."
    chmod 0755 "$STAGING_DIR"

    python3 - \
        "$STAGING_DIR" \
        "$release_path" \
        "$RADDAD_RELEASE_ROOT" \
        "$RELEASES_DIR" \
        "$EXPECTED_SHA" \
        "$expected_current_snapshot" <<'PY'
import hashlib
import os
import re
import stat
import sys

staging, release, root, releases, sha, expected_snapshot = sys.argv[1:]
if (
    not re.fullmatch(r"[0-9a-f]{40}", sha)
    or os.path.dirname(staging) != os.path.join(os.path.dirname(releases), ".staging")
    or not os.path.basename(staging).startswith(f"{sha}.")
    or os.path.dirname(release) != releases
    or os.path.basename(release) != sha
    or os.path.lexists(release)
):
    raise SystemExit("refusing unsafe release move")

current = os.path.join(root, "current")

def snapshot():
    if not os.path.lexists(current):
        return "absent"
    details = os.lstat(current)
    if not stat.S_ISLNK(details.st_mode):
        return f"unsafe:{details.st_dev}:{details.st_ino}:{details.st_mode}:{details.st_uid}"
    try:
        raw_target = os.readlink(current)
    except FileNotFoundError:
        return "raced"
    target = os.path.normpath(
        raw_target if os.path.isabs(raw_target) else os.path.join(root, raw_target)
    )
    identity = f"{details.st_dev}:{details.st_ino}:{details.st_uid}"
    if os.path.dirname(target) == releases and re.fullmatch(
        r"[0-9a-f]{40}", os.path.basename(target)
    ):
        return f"direct:{os.path.basename(target)}:{identity}"
    digest = hashlib.sha256(os.fsencode(raw_target)).hexdigest()
    return f"invalid:{identity}:{digest}"

if snapshot() != expected_snapshot:
    raise SystemExit("current changed before release publication; refusing the release move")

staging_details = os.lstat(staging)
os.rename(staging, release)
if snapshot() != expected_snapshot:
    release_details = os.lstat(release)
    if (
        release_details.st_dev != staging_details.st_dev
        or release_details.st_ino != staging_details.st_ino
    ):
        raise SystemExit("published release identity changed during current-state verification")
    os.rename(release, staging)
    raise SystemExit("current changed during release publication; reverted the release move")
PY
    STAGING_DIR=""
    validate_source directory "$release_path" "$EXPECTED_SHA" ||
        fail "Installed release failed post-move verification."
    log "Installed immutable release $EXPECTED_SHA."
}

prune_releases() {
    local current="$1"
    local previous="${2:-}"
    local expected_current_snapshot="$3"
    local known_sha

    RETENTION_TEMP="$(mktemp "$STAGING_ROOT/.retention.XXXXXX")"
    while IFS= read -r known_sha; do
        if validate_source \
            directory \
            "$RELEASES_DIR/$known_sha" \
            "$known_sha" >/dev/null 2>&1; then
            printf '%s\n' "$known_sha" >>"$RETENTION_TEMP" || return 1
        else
            log "Known-good record $known_sha is broken and will not consume retention." >&2
        fi
    done <"$KNOWN_GOOD_FILE"

    if ! python3 - \
        "$RADDAD_RELEASE_ROOT" \
        "$RELEASES_DIR" \
        "$KNOWN_GOOD_FILE" \
        "$RETENTION_TEMP" \
        "$RADDAD_RETENTION_COUNT" \
        "$current" \
        "$previous" \
        "$expected_current_snapshot" <<'PY'
import hashlib
import os
import re
import shutil
import stat
import sys
import tempfile

(
    root,
    releases,
    state_path,
    valid_state_path,
    retention_raw,
    current,
    previous,
    expected_current_snapshot,
) = sys.argv[1:]
retention = int(retention_raw)
sha_pattern = re.compile(r"[0-9a-f]{40}")
euid = os.geteuid()
entries = {}
current_path = os.path.join(root, "current")

if not re.fullmatch(
    rf"direct:{re.escape(current)}:[0-9]+:[0-9]+:[0-9]+",
    expected_current_snapshot,
):
    raise SystemExit("refusing an invalid expected current snapshot for retention")

def current_snapshot():
    if not os.path.lexists(current_path):
        return "absent"
    details = os.lstat(current_path)
    if not stat.S_ISLNK(details.st_mode):
        return f"unsafe:{details.st_dev}:{details.st_ino}:{details.st_mode}:{details.st_uid}"
    try:
        raw_target = os.readlink(current_path)
    except FileNotFoundError:
        return "raced"
    target = os.path.normpath(
        raw_target if os.path.isabs(raw_target) else os.path.join(root, raw_target)
    )
    identity = f"{details.st_dev}:{details.st_ino}:{details.st_uid}"
    if os.path.dirname(target) == releases and sha_pattern.fullmatch(
        os.path.basename(target)
    ):
        return f"direct:{os.path.basename(target)}:{identity}"
    digest = hashlib.sha256(os.fsencode(raw_target)).hexdigest()
    return f"invalid:{identity}:{digest}"

def require_expected_current():
    if current_snapshot() != expected_current_snapshot:
        raise SystemExit("current changed before retention; refusing all further cleanup")

require_expected_current()

for entry in os.scandir(releases):
    details = entry.stat(follow_symlinks=False)
    if (
        sha_pattern.fullmatch(entry.name)
        and stat.S_ISDIR(details.st_mode)
        and not entry.is_symlink()
    ):
        if details.st_uid != euid:
            raise SystemExit(f"release has the wrong owner: {entry.name}")
        if details.st_mode & (stat.S_IWGRP | stat.S_IWOTH):
            raise SystemExit(f"release is group- or world-writable: {entry.name}")
        entries[entry.name] = entry.path

with open(valid_state_path, encoding="ascii") as handle:
    known = handle.read().splitlines()

protected = {
    value
    for value in (current, previous)
    if value in entries and value in known
}
keep = set(protected)
for name in known:
    if len(keep) >= retention:
        break
    if name in entries:
        keep.add(name)

require_expected_current()
for name, path in entries.items():
    if name in keep:
        continue
    if os.path.dirname(path) != releases or not sha_pattern.fullmatch(name):
        raise SystemExit("refusing unsafe retention cleanup")
    require_expected_current()
    shutil.rmtree(path)
    print(f"[raddad-deploy] Removed expired inactive release {name}.")

retained_known = [name for name in known if name in keep]
require_expected_current()
descriptor, temporary = tempfile.mkstemp(prefix=".known-good.", dir=root)
try:
    os.fchmod(descriptor, 0o600)
    with os.fdopen(descriptor, "w", encoding="ascii") as handle:
        handle.write("".join(f"{name}\n" for name in retained_known))
        handle.flush()
        os.fsync(handle.fileno())
    require_expected_current()
    os.replace(temporary, state_path)
    os.chmod(state_path, 0o600)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
PY
    then
        rm -f -- "$RETENTION_TEMP"
        RETENTION_TEMP=""
        return 1
    fi
    rm -f -- "$RETENTION_TEMP"
    RETENTION_TEMP=""
}

if [[ "$MODE" == "list" ]]; then
    listed_snapshot="$(current_snapshot)" ||
        fail "Could not inspect the active release entry."
    listed_current="$(snapshot_sha "$listed_snapshot")"
    listed_label="$(snapshot_label "$listed_snapshot")"
    list_releases "$listed_current" "$listed_label" ||
        fail "Could not list retained releases."
    exit 0
fi

if [[ "$MODE" == "check" ]]; then
    validate_source archive "$ARTIFACT_PATH" "$EXPECTED_SHA" ||
        fail "Artifact verification failed."
    checked_snapshot="$(current_snapshot)" ||
        fail "Could not inspect the active release."
    previous="$(snapshot_sha "$checked_snapshot")"
    log "Dry run passed for $EXPECTED_SHA."
    log "Release root: $RADDAD_RELEASE_ROOT"
    log "Current release: ${previous:-none}"
    log "No release, symlink, or public-site state was changed."
    exit 0
fi

acquire_lock
previous_snapshot="$(current_snapshot)" ||
    fail "Could not inspect the active release entry."
previous_sha="$(snapshot_sha "$previous_snapshot")"

if [[ "$MODE" == "deploy" || "$MODE" == "prepare" ]]; then
    if [[ "$previous_sha" == "$EXPECTED_SHA" ]] &&
       [[ ! -d "$RELEASES_DIR/$EXPECTED_SHA" || -L "$RELEASES_DIR/$EXPECTED_SHA" ]]; then
        fail "Current points to the missing candidate release; refusing to publish it during $MODE."
    fi
    validate_source archive "$ARTIFACT_PATH" "$EXPECTED_SHA" ||
        fail "Artifact verification failed."
    install_release "$previous_snapshot"
else
    rollback_path="$RELEASES_DIR/$EXPECTED_SHA"
    [[ -d "$rollback_path" && ! -L "$rollback_path" ]] ||
        fail "Rollback target is not a retained release: $EXPECTED_SHA"
    validate_source directory "$rollback_path" "$EXPECTED_SHA" ||
        fail "Rollback target failed verification."
    is_known_good "$EXPECTED_SHA" ||
        fail "Rollback target was never recorded as passing public health: $EXPECTED_SHA"
fi

if [[ "$MODE" == "prepare" ]]; then
    log "prepare succeeded for $EXPECTED_SHA; current was not changed."
    exit 0
fi

SAFE_PREVIOUS_SHA=""
if [[ -n "$previous_sha" ]]; then
    if [[ "$MODE" == "deploy" ]]; then
        validate_source directory "$RELEASES_DIR/$previous_sha" "$previous_sha" ||
            fail "The active release failed verification; use rollback recovery instead."
        if ! is_known_good "$previous_sha"; then
            log "Active release $previous_sha has no known-good record; verifying it before activation."
            health_check "$previous_sha" ||
                fail "The active release did not pass public health and cannot be used as rollback protection."
            record_known_good "$previous_sha" ||
                fail "Could not record the active release as known-good."
        fi
        SAFE_PREVIOUS_SHA="$previous_sha"
    elif [[ "$previous_sha" != "$EXPECTED_SHA" ]]; then
        if validate_source directory "$RELEASES_DIR/$previous_sha" "$previous_sha" &&
           is_known_good "$previous_sha"; then
            SAFE_PREVIOUS_SHA="$previous_sha"
        else
            log "Active release $previous_sha is not a valid known-good fallback; rollback will not restore it." >&2
        fi
    fi
fi

if [[ "$previous_sha" != "$EXPECTED_SHA" ]]; then
    ACTIVATION_CANDIDATE_SHA="$EXPECTED_SHA"
    ACTIVATION_PENDING=1
    atomic_activate "$EXPECTED_SHA" "$previous_snapshot" ||
        fail "Atomic current-symlink activation failed."
fi

if health_check "$EXPECTED_SHA"; then
    retained_current_snapshot="$(current_snapshot)" ||
        fail "Public health passed, but current could not be inspected before retention."
    case "$retained_current_snapshot" in
        direct:"$EXPECTED_SHA":*)
            ;;
        *)
            fail "Public health passed, but current changed before retention."
            ;;
    esac
    record_known_good "$EXPECTED_SHA" ||
        fail "Public health passed, but known-good state could not be committed."
    ACTIVATION_PENDING=0
    prune_releases \
        "$EXPECTED_SHA" \
        "$SAFE_PREVIOUS_SHA" \
        "$retained_current_snapshot" ||
        fail "Activation succeeded, but safe release retention failed."
    log "$MODE succeeded for $EXPECTED_SHA."
    exit 0
fi

log "Health check failed for $EXPECTED_SHA; restoring the previous release." >&2
if [[ "$ACTIVATION_PENDING" != "1" ]]; then
    fail "Health failed for $EXPECTED_SHA; current was not changed by this invocation."
fi
restore_activation_after_failure "public health check failure" ||
    fail "Health failed and production state could not be restored safely."
case "$LAST_RESTORE_RESULT" in
    restored:*)
        restored_sha="${LAST_RESTORE_RESULT#restored:}"
        if health_check "$restored_sha"; then
            fail "Health failed for $EXPECTED_SHA; known-good release $restored_sha was restored."
        fi
        fail "Health failed for $EXPECTED_SHA; $restored_sha was restored but public health is still failing."
        ;;
    removed)
        fail "Health failed for $EXPECTED_SHA; no valid prior release existed, so current was removed."
        ;;
    changed)
        fail "Health failed for $EXPECTED_SHA; current changed concurrently and was not overwritten."
        ;;
    *)
        fail "Health failed for $EXPECTED_SHA and restoration returned an unknown state."
        ;;
esac
