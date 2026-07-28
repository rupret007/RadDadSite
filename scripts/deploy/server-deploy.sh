#!/usr/bin/env bash

set -Eeuo pipefail
IFS=$'\n\t'

LOCK_HELD=0
LOCK_DIR=""
STAGING_DIR=""

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

Modes:
  check       Validate configuration, layout, and an artifact without changing releases.
  prepare     Install a verified release without changing the current symlink.
  deploy      Install a verified artifact, atomically activate it, and health-check it.
  rollback    Atomically activate an already retained, verified release.
EOF
}

# shellcheck disable=SC2329 # Invoked indirectly by the EXIT trap.
cleanup() {
    local status=$?

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

    if [[ "$LOCK_HELD" == "1" && -n "$LOCK_DIR" ]]; then
        rm -f -- "$LOCK_DIR/owner"
        rmdir -- "$LOCK_DIR" 2>/dev/null || true
    fi

    exit "$status"
}

trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

MODE="${1:-}"
if [[ -z "$MODE" || "$MODE" == "-h" || "$MODE" == "--help" ]]; then
    usage
    [[ -n "$MODE" ]] && exit 0
    exit 2
fi
shift

case "$MODE" in
    check|prepare|deploy|rollback)
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

[[ "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]] ||
    fail "--sha must be an exact 40-character lowercase Git commit SHA."
[[ "$CONFIG_PATH" == /* ]] ||
    fail "--config must be an absolute path."
[[ -f "$CONFIG_PATH" && ! -L "$CONFIG_PATH" && -r "$CONFIG_PATH" ]] ||
    fail "Config must be a readable regular file, not a symlink: $CONFIG_PATH"

if [[ "$MODE" == "rollback" ]]; then
    [[ -z "$ARTIFACT_PATH" ]] ||
        fail "rollback does not accept --artifact."
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
                if [[ "${RADDAD_RELEASE_ROOT+x}" != "x" ]]; then
                    RADDAD_RELEASE_ROOT="$value"
                fi
                ;;
            RADDAD_SITE_URL)
                if [[ "${RADDAD_SITE_URL+x}" != "x" ]]; then
                    RADDAD_SITE_URL="$value"
                fi
                ;;
            RADDAD_RETENTION_COUNT)
                if [[ "${RADDAD_RETENTION_COUNT+x}" != "x" ]]; then
                    RADDAD_RETENTION_COUNT="$value"
                fi
                ;;
            RADDAD_HEALTH_ATTEMPTS)
                if [[ "${RADDAD_HEALTH_ATTEMPTS+x}" != "x" ]]; then
                    RADDAD_HEALTH_ATTEMPTS="$value"
                fi
                ;;
            RADDAD_HEALTH_DELAY_SECONDS)
                if [[ "${RADDAD_HEALTH_DELAY_SECONDS+x}" != "x" ]]; then
                    RADDAD_HEALTH_DELAY_SECONDS="$value"
                fi
                ;;
            *)
                fail "Unknown config key: $key"
                ;;
        esac
    done < "$CONFIG_PATH"
}

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

validate_layout() {
    python3 - "$RADDAD_RELEASE_ROOT" "${HOME:-}" <<'PY'
import os
import re
import sys

root, home = sys.argv[1:]

def stop(message):
    raise SystemExit(message)

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
if not os.path.isdir(root) or os.path.islink(root):
    stop("release root must be a pre-created real directory")
if os.path.realpath(root) != root:
    stop("release root or one of its parents resolves through a symlink")
if not os.access(root, os.W_OK | os.X_OK):
    stop("release root is not writable by the deployment user")

releases = os.path.join(root, "releases")
staging = os.path.join(root, ".staging")
for path, label in ((releases, "releases"), (staging, "staging")):
    if not os.path.isdir(path) or os.path.islink(path):
        stop(f"{label} must be a pre-created real directory")
    if os.path.realpath(path) != path:
        stop(f"{label} resolves through a symlink")
    if not os.access(path, os.W_OK | os.X_OK):
        stop(f"{label} is not writable by the deployment user")

current = os.path.join(root, "current")
if os.path.lexists(current):
    if not os.path.islink(current):
        stop("current must be a symlink")
    target = os.path.realpath(current)
    if (
        os.path.dirname(target) != releases
        or not re.fullmatch(r"[0-9a-f]{40}", os.path.basename(target))
        or not os.path.isdir(target)
        or os.path.islink(target)
    ):
        stop("current must resolve to one direct, versioned release directory")

lock = os.path.join(root, ".deploy.lock")
if os.path.lexists(lock) and not os.path.isdir(lock):
    stop("deployment lock path exists but is not a directory")
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
ROOT_FILES = {
    "RadDad_Logo.jpg",
    "SHA256SUMS",
    "artifact-manifest.json",
    "index.html",
    "script.js",
    "styles.css",
    "version.json",
}
ASSET_EXTENSIONS = {
    ".avif", ".gif", ".ico", ".ics", ".jpeg", ".jpg", ".png",
    ".svg", ".webp", ".woff", ".woff2",
}
REQUIRED_FILES = ROOT_FILES
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
    if path in ROOT_FILES:
        return True
    if not path.startswith("assets/"):
        return False
    suffix = PurePosixPath(path).suffix.lower()
    return suffix in ASSET_EXTENSIONS

def allowed_directory(path):
    return path == "assets" or path.startswith("assets/")

def read_directory(path):
    if not os.path.isabs(path):
        stop("release directory must be absolute")
    if not os.path.isdir(path) or os.path.islink(path):
        stop("release directory must be a real directory")

    files = {}
    directories = set()
    total_bytes = 0

    def visit(directory, relative_prefix=""):
        nonlocal total_bytes
        for entry in os.scandir(directory):
            relative = f"{relative_prefix}/{entry.name}" if relative_prefix else entry.name
            canonical = canonical_path(relative)
            details = entry.stat(follow_symlinks=False)
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
    details = os.lstat(path)
    if not stat.S_ISREG(details.st_mode):
        stop("artifact must be a regular file, not a symlink")
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

current_sha() {
    python3 - "$CURRENT_LINK" "$RELEASES_DIR" <<'PY'
import os
import re
import sys

current, releases = sys.argv[1:]
if not os.path.lexists(current):
    print("")
    raise SystemExit(0)
if not os.path.islink(current):
    raise SystemExit("current is not a symlink")
target = os.path.realpath(current)
if (
    os.path.dirname(target) != releases
    or not re.fullmatch(r"[0-9a-f]{40}", os.path.basename(target))
    or not os.path.isdir(target)
    or os.path.islink(target)
):
    raise SystemExit("current does not resolve to a valid release")
print(os.path.basename(target))
PY
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

    python3 - "$RADDAD_RELEASE_ROOT" "$sha" <<'PY'
import os
import re
import sys

root, sha = sys.argv[1:]
if not re.fullmatch(r"[0-9a-f]{40}", sha):
    raise SystemExit("refusing unsafe release identifier")
release = os.path.join(root, "releases", sha)
if not os.path.isdir(release) or os.path.islink(release):
    raise SystemExit("release target is not a real directory")
current = os.path.join(root, "current")
temporary = os.path.join(root, f".current.{os.getpid()}.tmp")
if os.path.lexists(temporary):
    raise SystemExit("temporary current link already exists")
os.symlink(os.path.join("releases", sha), temporary)
try:
    os.replace(temporary, current)
finally:
    if os.path.lexists(temporary):
        os.unlink(temporary)
PY
}

remove_current_if_matches() {
    local sha="$1"

    python3 - "$CURRENT_LINK" "$RELEASES_DIR" "$sha" <<'PY'
import os
import sys

current, releases, sha = sys.argv[1:]
if not os.path.lexists(current):
    raise SystemExit(0)
if not os.path.islink(current):
    raise SystemExit("current is not a symlink")
if os.path.realpath(current) != os.path.join(releases, sha):
    raise SystemExit("current changed unexpectedly; refusing to remove it")
os.unlink(current)
PY
}

health_check() {
    local sha="$1"
    local attempt response

    command -v curl >/dev/null 2>&1 ||
        fail "curl is required for deployment and rollback health checks."

    for ((attempt = 1; attempt <= RADDAD_HEALTH_ATTEMPTS; attempt += 1)); do
        if response="$(
            curl \
                --fail \
                --silent \
                --show-error \
                --proto '=https' \
                --connect-timeout 5 \
                --max-time 15 \
                -H 'Accept: application/json' \
                -H 'Cache-Control: no-cache' \
                "${RADDAD_SITE_URL}/version.json?v=${sha}"
        )" && printf '%s' "$response" | python3 -c '
import json
import sys

expected = sys.argv[1]
try:
    value = json.load(sys.stdin)
except (UnicodeDecodeError, json.JSONDecodeError):
    raise SystemExit(1)
if not isinstance(value, dict) or value.get("commitSha") != expected:
    raise SystemExit(1)
' "$sha"; then
            log "Public health check reports expected commit $sha."
            return 0
        fi

        if ((attempt < RADDAD_HEALTH_ATTEMPTS)); then
            sleep "$RADDAD_HEALTH_DELAY_SECONDS"
        fi
    done

    return 1
}

install_release() {
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

    python3 - "$STAGING_DIR" "$release_path" "$RELEASES_DIR" "$EXPECTED_SHA" <<'PY'
import os
import re
import sys

staging, release, releases, sha = sys.argv[1:]
if (
    not re.fullmatch(r"[0-9a-f]{40}", sha)
    or os.path.dirname(staging) != os.path.join(os.path.dirname(releases), ".staging")
    or not os.path.basename(staging).startswith(f"{sha}.")
    or os.path.dirname(release) != releases
    or os.path.basename(release) != sha
    or os.path.lexists(release)
):
    raise SystemExit("refusing unsafe release move")
os.rename(staging, release)
PY
    STAGING_DIR=""
    validate_source directory "$release_path" "$EXPECTED_SHA" ||
        fail "Installed release failed post-move verification."
    log "Installed immutable release $EXPECTED_SHA."
}

prune_releases() {
    local current="$1"
    local previous="${2:-}"

    python3 - "$RELEASES_DIR" "$RADDAD_RETENTION_COUNT" "$current" "$previous" <<'PY'
import os
import re
import shutil
import sys

releases, retention_raw, current, previous = sys.argv[1:]
retention = int(retention_raw)
sha_pattern = re.compile(r"[0-9a-f]{40}")
entries = []

for entry in os.scandir(releases):
    if (
        sha_pattern.fullmatch(entry.name)
        and entry.is_dir(follow_symlinks=False)
        and not entry.is_symlink()
    ):
        entries.append((entry.stat(follow_symlinks=False).st_mtime_ns, entry.name, entry.path))

entries.sort(reverse=True)
protected = {value for value in (current, previous) if sha_pattern.fullmatch(value or "")}
keep = set(protected)
for _, name, _ in entries:
    if len(keep) >= retention:
        break
    keep.add(name)

for _, name, path in entries:
    if name in keep:
        continue
    if os.path.dirname(path) != releases or not sha_pattern.fullmatch(name):
        raise SystemExit("refusing unsafe retention cleanup")
    shutil.rmtree(path)
    print(f"[raddad-deploy] Removed expired inactive release {name}.")
PY
}

if [[ "$MODE" == "check" ]]; then
    validate_source archive "$ARTIFACT_PATH" "$EXPECTED_SHA" ||
        fail "Artifact verification failed."
    previous="$(current_sha)" ||
        fail "Could not identify the active release."
    log "Dry run passed for $EXPECTED_SHA."
    log "Release root: $RADDAD_RELEASE_ROOT"
    log "Current release: ${previous:-none}"
    log "No release, symlink, or public-site state was changed."
    exit 0
fi

acquire_lock
previous_sha="$(current_sha)" ||
    fail "Could not identify the active release."
if [[ -n "$previous_sha" && "$MODE" != "prepare" ]]; then
    validate_source directory "$RELEASES_DIR/$previous_sha" "$previous_sha" ||
        fail "The active release failed verification; refusing to change current."
fi

if [[ "$MODE" == "deploy" || "$MODE" == "prepare" ]]; then
    validate_source archive "$ARTIFACT_PATH" "$EXPECTED_SHA" ||
        fail "Artifact verification failed."
    install_release
else
    rollback_path="$RELEASES_DIR/$EXPECTED_SHA"
    [[ -d "$rollback_path" && ! -L "$rollback_path" ]] ||
        fail "Rollback target is not a retained release: $EXPECTED_SHA"
    validate_source directory "$rollback_path" "$EXPECTED_SHA" ||
        fail "Rollback target failed verification."
fi

if [[ "$MODE" == "prepare" ]]; then
    log "prepare succeeded for $EXPECTED_SHA; current was not changed."
    exit 0
fi

if [[ "$previous_sha" != "$EXPECTED_SHA" ]]; then
    atomic_activate "$EXPECTED_SHA" ||
        fail "Atomic current-symlink activation failed."
fi

if health_check "$EXPECTED_SHA"; then
    log "$MODE succeeded for $EXPECTED_SHA."
    if [[ "$MODE" == "deploy" ]]; then
        prune_releases "$EXPECTED_SHA" "$previous_sha"
    fi
    exit 0
fi

log "Health check failed for $EXPECTED_SHA; restoring the previous release." >&2
if [[ -n "$previous_sha" ]]; then
    atomic_activate "$previous_sha" ||
        fail "Health failed and automatic restoration of $previous_sha also failed."
    if health_check "$previous_sha"; then
        fail "Health failed for $EXPECTED_SHA; previous release $previous_sha was restored."
    fi
    fail "Health failed for $EXPECTED_SHA; previous release $previous_sha was restored but did not pass its health check."
fi

remove_current_if_matches "$EXPECTED_SHA" ||
    fail "Health failed and the first-release current link could not be removed safely."
fail "Health failed for $EXPECTED_SHA; there was no previous release to restore."
