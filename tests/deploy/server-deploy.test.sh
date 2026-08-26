#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT=$(cd "$(dirname "$0")/../.." && pwd)
DEPLOY_HELPER=$PROJECT_ROOT/scripts/deploy/server-deploy.sh
TEMP_PARENT=${TMPDIR:-/tmp}
TEMP_PARENT=${TEMP_PARENT%/}
TEST_TMP=$(mktemp -d "$TEMP_PARENT/raddad-server-deploy-test.XXXXXX")
TEST_TMP=$(cd "$TEST_TMP" && pwd -P)
MOCK_BIN=$TEST_TMP/mock-bin
PASS_COUNT=0

cleanup() {
    local status=$?
    if [[ -d $TEST_TMP ]]; then
        find "$TEST_TMP" -depth -delete 2>/dev/null || true
    fi
    exit "$status"
}
trap cleanup EXIT HUP INT TERM

fail() {
    printf 'not ok - %s\n' "$*" >&2
    exit 1
}

pass() {
    PASS_COUNT=$((PASS_COUNT + 1))
    printf 'ok %d - %s\n' "$PASS_COUNT" "$*"
}

expect_failure() {
    local label=$1
    shift
    if "$@" >"$TEST_TMP/last-failure.log" 2>&1; then
        fail "$label unexpectedly succeeded"
    fi
    pass "$label"
}

wait_for_file() {
    local path=$1 label=$2
    local remaining=200

    while ((remaining > 0)); do
        [[ ! -e "$path" ]] || return 0
        sleep 0.05
        remaining=$((remaining - 1))
    done
    fail "timed out waiting for $label"
}

wait_for_staging() {
    local root=$1 sha=$2 pid=$3 label=$4
    local remaining=1000
    local -a matches=()

    while ((remaining > 0)); do
        matches=("$root/.staging/$sha."*)
        [[ ! -d ${matches[0]} ]] || return 0
        kill -0 "$pid" 2>/dev/null ||
            fail "$label exited before its staging directory could be observed"
        sleep 0.005
        remaining=$((remaining - 1))
    done
    fail "timed out waiting for $label staging"
}

replace_current() {
    local root=$1 sha=$2

    python3 - "$root" "$sha" <<'PY'
import os
import sys

root, sha = sys.argv[1:]
temporary = os.path.join(root, ".test-current.tmp")
if os.path.lexists(temporary):
    os.unlink(temporary)
os.symlink(os.path.join("releases", sha), temporary)
os.replace(temporary, os.path.join(root, "current"))
PY
}

mkdir "$MOCK_BIN"

cat >"$MOCK_BIN/curl" <<'EOF'
#!/usr/bin/env bash
set -u
url=
output=
saw_https_proto=false
while (($#)); do
    case "$1" in
        --location)
            exit 64
            ;;
        --proto)
            [[ "${2:-}" == "=https" ]] || exit 64
            saw_https_proto=true
            shift 2
            ;;
        --output)
            output=${2:-}
            shift 2
            ;;
        https://*)
            url=$1
            shift
            ;;
        *)
            shift
            ;;
    esac
done
[[ "$saw_https_proto" == true ]] || exit 64
[[ -n "$url" && -n "$output" ]] || exit 64
sha=${url##*v=}
request=${url#https://}
request=/${request#*/}
request=${request%%\?*}
request=${request#/}
[[ -n "$request" ]] || request=index.html

case "${MOCK_HEALTH:-success}" in
    success)
        ;;
    fail-sha)
        if [[ "$sha" == "${MOCK_FAIL_SHA:-}" ]]; then
            exit 22
        fi
        ;;
    fail-path)
        if [[ "$request" == "${MOCK_FAIL_PATH:-}" ]] &&
           [[ -z "${MOCK_FAIL_SHA:-}" || "$sha" == "$MOCK_FAIL_SHA" ]]; then
            exit 22
        fi
        ;;
    corrupt-path)
        if [[ "$request" == "${MOCK_FAIL_PATH:-}" ]] &&
           [[ -z "${MOCK_FAIL_SHA:-}" || "$sha" == "$MOCK_FAIL_SHA" ]]; then
            printf 'corrupt public response\n' >"$output"
            exit 0
        fi
        ;;
    block-sha)
        if [[ "$sha" == "${MOCK_BLOCK_SHA:-}" ]]; then
            : >"${MOCK_BLOCK_STARTED:?}"
            while [[ ! -e "${MOCK_BLOCK_RELEASE:?}" ]]; do
                sleep 0.05
            done
        fi
        ;;
    block-after-path)
        if [[ "$request" == "${MOCK_BLOCK_PATH:-}" ]] &&
           [[ -z "${MOCK_BLOCK_SHA:-}" || "$sha" == "$MOCK_BLOCK_SHA" ]]; then
            cp "$MOCK_RELEASE_ROOT/current/$request" "$output"
            : >"${MOCK_BLOCK_STARTED:?}"
            while [[ ! -e "${MOCK_BLOCK_RELEASE:?}" ]]; do
                sleep 0.05
            done
            exit 0
        fi
        ;;
    *)
        exit 22
        ;;
esac

cp "$MOCK_RELEASE_ROOT/current/$request" "$output"
EOF

chmod +x "$MOCK_BIN/curl"
export PATH=$MOCK_BIN:$PATH

SHA_A=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
SHA_B=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
SHA_C=cccccccccccccccccccccccccccccccccccccccc
SHA_D=dddddddddddddddddddddddddddddddddddddddd
SHA_E=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
SHA_F=ffffffffffffffffffffffffffffffffffffffff
SHA_G=1111111111111111111111111111111111111111
SHA_H=2222222222222222222222222222222222222222
SHA_I=3333333333333333333333333333333333333333
ARTIFACT_A="$TEST_TMP/artifact A.tar.gz"
ARTIFACT_B=$TEST_TMP/artifact-b.tar.gz
ARTIFACT_C=$TEST_TMP/artifact-c.tar.gz
ARTIFACT_D=$TEST_TMP/artifact-d.tar.gz
ARTIFACT_E=$TEST_TMP/artifact-e.tar.gz
ARTIFACT_F=$TEST_TMP/artifact-f.tar.gz
ARTIFACT_G=$TEST_TMP/artifact-g.tar.gz
ARTIFACT_LEGACY=$TEST_TMP/artifact-legacy-inventory.tar.gz
ARTIFACT_LEGACY_UNSAFE=$TEST_TMP/artifact-legacy-unsafe-path.tar.gz
ARTIFACT_SLOW=$TEST_TMP/artifact-slow.tar.gz
ARTIFACT_DUPLICATE=$TEST_TMP/artifact-duplicate-sums.tar.gz
ARTIFACT_CORRUPT=$TEST_TMP/artifact-corrupt.tar.gz
ARTIFACT_TRAVERSAL=$TEST_TMP/artifact-traversal.tar.gz
ARTIFACT_SYMLINK=$TEST_TMP/artifact-symlink.tar.gz
ARTIFACT_UNEXPECTED=$TEST_TMP/artifact-unexpected.tar.gz
ARTIFACT_EXTRA_ASSET=$TEST_TMP/artifact-extra-allowed-asset.tar.gz
REQUIRED_PRODUCTION_PATHS=(
    "RadDad_Logo.jpg"
    "SHA256SUMS"
    "artifact-manifest.json"
    "assets/rad-dad-friends-guitars-growlers-2026-1122.webp"
    "assets/rad-dad-friends-guitars-growlers-2026-561.webp"
    "assets/rad-dad-friends-guitars-growlers-2026-v2-1024.webp"
    "assets/rad-dad-friends-guitars-growlers-2026-v2-512.webp"
    "assets/rad-dad-friends-guitars-growlers-2026-v2-full.png"
    "assets/rad-dad-friends-guitars-growlers-2026-full.png"
    "assets/rad-dad-friends-guitars-growlers-2026.ics"
    "assets/rad-dad-social-2026-v2.png"
    "assets/rad-dad-social-2026.png"
    "assets/rad-dad-tap-og.png"
    "assets/story-of-us-cassette-render.webp"
    "assets/story-of-us-cover.webp"
    "assets/the-middle-jimmy-eat-world-thumbnail.webp"
    "assets/wildflower-2026-poster-720.webp"
    "assets/wildflower-she-green-day.webp"
    "index.html"
    "qr/index.html"
    "qr/script.js"
    "qr/styles.css"
    "script.js"
    "styles.css"
    "tap/index.html"
    "version.json"
)
MISSING_ARTIFACTS=()

create_artifact() {
    local output=$1 sha=$2 variant=${3:-valid}
    python3 - "$output" "$sha" "$variant" <<'PY'
import hashlib
import io
import json
import os
import tarfile
import tempfile
from pathlib import Path

output, sha, variant = os.sys.argv[1:4]
timestamp = "2026-07-28T12:00:00.000Z"
missing_path = variant.split(":", 1)[1] if variant.startswith("missing:") else None

with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    source_paths = [
        "RadDad_Logo.jpg",
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
        "qr/index.html",
        "qr/script.js",
        "qr/styles.css",
        "script.js",
        "styles.css",
        "tap/index.html",
    ]
    for relative_path in source_paths:
        path = root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.suffix == ".html":
            path.write_text("<!doctype html><title>Rad Dad</title>\n", encoding="utf-8")
        elif path.suffix == ".css":
            path.write_text("body { color: white; }\n", encoding="utf-8")
        elif path.suffix == ".js":
            path.write_text("document.documentElement.dataset.ready = 'true';\n", encoding="utf-8")
        elif path.suffix == ".ics":
            path.write_text("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", encoding="utf-8")
        else:
            path.write_bytes(f"fixture:{relative_path}".encode("utf-8"))
    version = {"commitSha": sha, "timestamp": timestamp}
    (root / "version.json").write_text(
        json.dumps(version, separators=(",", ":")) + "\n", encoding="utf-8"
    )

    def details(path):
        data = (root / path).read_bytes()
        return {
            "path": path,
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
        }

    payload_paths = sorted([*source_paths, "version.json"])
    if variant == "legacy-inventory":
        current_assets = [path for path in payload_paths if path.startswith("assets/")]
        for path in current_assets:
            (root / path).unlink()
            payload_paths.remove(path)
        legacy_path = "assets/legacy-show-poster.webp"
        (root / legacy_path).write_bytes(b"fixture-legacy-poster")
        payload_paths.append(legacy_path)
        payload_paths.sort()
    if variant == "legacy-unsafe-path":
        current_assets = [path for path in payload_paths if path.startswith("assets/")]
        for path in current_assets:
            (root / path).unlink()
            payload_paths.remove(path)
        unsafe_path = "assets/legacy poster?.webp"
        (root / unsafe_path).write_bytes(b"fixture-unsafe-legacy-poster")
        payload_paths.append(unsafe_path)
        payload_paths.sort()
    if variant == "slow-extraction":
        slow_path = "assets/wildflower-2026-poster-720.webp"
        (root / slow_path).write_bytes(os.urandom(8 * 1024 * 1024))
    if variant == "extra-allowed-asset":
        extra_path = "assets/extra-production-looking.webp"
        (root / extra_path).write_bytes(b"self-consistent extra asset")
        payload_paths.append(extra_path)
        payload_paths.sort()
    if missing_path in payload_paths:
        (root / missing_path).unlink()
        payload_paths.remove(missing_path)

    manifest = {
        "schemaVersion": 1,
        "artifactRoot": "dist/client",
        "commitSha": sha,
        "timestamp": timestamp,
        "files": [details(path) for path in payload_paths],
    }
    if missing_path != "artifact-manifest.json":
        (root / "artifact-manifest.json").write_text(
            json.dumps(manifest, separators=(",", ":")) + "\n", encoding="utf-8"
        )

    sum_paths = sorted([
        *(["artifact-manifest.json"] if missing_path != "artifact-manifest.json" else []),
        *payload_paths,
    ])
    sums = [
        f"{hashlib.sha256((root / path).read_bytes()).hexdigest()}  {path}"
        for path in sum_paths
    ]
    if variant == "duplicate-sums":
        sums.append(sums[-1])
    if missing_path != "SHA256SUMS":
        (root / "SHA256SUMS").write_text("\n".join(sums) + "\n", encoding="utf-8")

    if variant == "corrupt":
        (root / "index.html").write_text("tampered after checksums\n", encoding="utf-8")
    if variant == "unexpected":
        (root / "package.json").write_text('{"private":true}\n', encoding="utf-8")

    with tarfile.open(output, "w:gz") as bundle:
        for path in sorted(root.iterdir()):
            bundle.add(path, arcname=path.name, recursive=True)

        if variant == "traversal":
            data = b"escape"
            member = tarfile.TarInfo("../escape.txt")
            member.size = len(data)
            bundle.addfile(member, io.BytesIO(data))
        if variant == "symlink":
            member = tarfile.TarInfo("assets/link")
            member.type = tarfile.SYMTYPE
            member.linkname = "/etc/passwd"
            bundle.addfile(member)
PY
}

create_artifact "$ARTIFACT_A" "$SHA_A"
create_artifact "$ARTIFACT_B" "$SHA_B"
create_artifact "$ARTIFACT_C" "$SHA_C"
create_artifact "$ARTIFACT_D" "$SHA_D"
create_artifact "$ARTIFACT_E" "$SHA_E"
create_artifact "$ARTIFACT_F" "$SHA_F"
create_artifact "$ARTIFACT_G" "$SHA_G"
create_artifact "$ARTIFACT_LEGACY" "$SHA_H" legacy-inventory
create_artifact "$ARTIFACT_LEGACY_UNSAFE" "$SHA_I" legacy-unsafe-path
create_artifact "$ARTIFACT_SLOW" "$SHA_G" slow-extraction
create_artifact "$ARTIFACT_DUPLICATE" "$SHA_C" duplicate-sums
create_artifact "$ARTIFACT_CORRUPT" "$SHA_C" corrupt
create_artifact "$ARTIFACT_TRAVERSAL" "$SHA_C" traversal
create_artifact "$ARTIFACT_SYMLINK" "$SHA_C" symlink
create_artifact "$ARTIFACT_UNEXPECTED" "$SHA_C" unexpected
create_artifact "$ARTIFACT_EXTRA_ASSET" "$SHA_C" extra-allowed-asset
for required_index in "${!REQUIRED_PRODUCTION_PATHS[@]}"; do
    missing_artifact="$TEST_TMP/artifact-missing-${required_index}.tar.gz"
    create_artifact \
        "$missing_artifact" \
        "$SHA_C" \
        "missing:${REQUIRED_PRODUCTION_PATHS[$required_index]}"
    MISSING_ARTIFACTS[required_index]=$missing_artifact
done
chmod 0644 \
    "$ARTIFACT_A" \
    "$ARTIFACT_B" \
    "$ARTIFACT_C" \
    "$ARTIFACT_D" \
    "$ARTIFACT_E" \
    "$ARTIFACT_F" \
    "$ARTIFACT_G" \
    "$ARTIFACT_LEGACY" \
    "$ARTIFACT_LEGACY_UNSAFE" \
    "$ARTIFACT_SLOW" \
    "$ARTIFACT_DUPLICATE" \
    "$ARTIFACT_CORRUPT" \
    "$ARTIFACT_TRAVERSAL" \
    "$ARTIFACT_SYMLINK" \
    "$ARTIFACT_UNEXPECTED" \
    "$ARTIFACT_EXTRA_ASSET" \
    "${MISSING_ARTIFACTS[@]}"

RELEASE_ROOT=$TEST_TMP/production
export MOCK_RELEASE_ROOT=$RELEASE_ROOT
CONFIG=$TEST_TMP/raddad-deploy.conf
cat >"$CONFIG" <<EOF
RADDAD_RELEASE_ROOT=$RELEASE_ROOT
RADDAD_SITE_URL=https://raddadband.example
RADDAD_RETENTION_COUNT=5
RADDAD_HEALTH_ATTEMPTS=1
RADDAD_HEALTH_DELAY_SECONDS=0
EOF
chmod 600 "$CONFIG"

mkdir -p "$RELEASE_ROOT/releases" "$RELEASE_ROOT/.staging"
chmod 0755 "$RELEASE_ROOT" "$RELEASE_ROOT/releases"
chmod 0700 "$RELEASE_ROOT/.staging"
before_check=$(find "$RELEASE_ROOT" -print | LC_ALL=C sort)
"$DEPLOY_HELPER" check --sha "$SHA_A" --artifact "$ARTIFACT_A" --config "$CONFIG" \
    >"$TEST_TMP/check.log"
after_check=$(find "$RELEASE_ROOT" -print | LC_ALL=C sort)
[[ "$before_check" == "$after_check" ]] || fail "check mode changed the release layout"
grep -q "Dry run passed for $SHA_A" "$TEST_TMP/check.log" ||
    fail "check mode did not report validation"
pass "check validates an artifact with a whitespace path without mutating release state"

expect_failure "check rejects an artifact whose version SHA differs" \
    "$DEPLOY_HELPER" check --sha "$SHA_B" --artifact "$ARTIFACT_A" --config "$CONFIG"
after_failed_check=$(find "$RELEASE_ROOT" -print | LC_ALL=C sort)
[[ "$before_check" == "$after_failed_check" ]] ||
    fail "failed check changed the release layout"

expect_failure "check rejects duplicate SHA256SUMS paths" \
    "$DEPLOY_HELPER" check --sha "$SHA_C" --artifact "$ARTIFACT_DUPLICATE" --config "$CONFIG"

expect_failure "check rejects a checksum mismatch" \
    "$DEPLOY_HELPER" check --sha "$SHA_C" --artifact "$ARTIFACT_CORRUPT" --config "$CONFIG"

expect_failure "check rejects archive path traversal" \
    "$DEPLOY_HELPER" check --sha "$SHA_C" --artifact "$ARTIFACT_TRAVERSAL" --config "$CONFIG"
[[ -z "$(find "$TEST_TMP" -name escape.txt -print -quit)" ]] ||
    fail "path traversal escaped into the deployment tree"

expect_failure "check rejects archive symlinks" \
    "$DEPLOY_HELPER" check --sha "$SHA_C" --artifact "$ARTIFACT_SYMLINK" --config "$CONFIG"

expect_failure "check rejects repository-only files even when archived" \
    "$DEPLOY_HELPER" check --sha "$SHA_C" --artifact "$ARTIFACT_UNEXPECTED" --config "$CONFIG"

expect_failure "check rejects a self-consistent extra production-looking asset" \
    "$DEPLOY_HELPER" check --sha "$SHA_C" --artifact "$ARTIFACT_EXTRA_ASSET" --config "$CONFIG"

expect_failure "check rejects a historical inventory as a new production artifact" \
    "$DEPLOY_HELPER" check --sha "$SHA_H" --artifact "$ARTIFACT_LEGACY" --config "$CONFIG"

for required_index in "${!REQUIRED_PRODUCTION_PATHS[@]}"; do
    expect_failure \
        "check rejects an artifact missing ${REQUIRED_PRODUCTION_PATHS[$required_index]}" \
        "$DEPLOY_HELPER" check \
        --sha "$SHA_C" \
        --artifact "${MISSING_ARTIFACTS[$required_index]}" \
        --config "$CONFIG"
done

RADDAD_RELEASE_ROOT=$HOME \
RADDAD_SITE_URL=https://environment-override.example \
    "$DEPLOY_HELPER" check --sha "$SHA_A" --artifact "$ARTIFACT_A" --config "$CONFIG" \
    >"$TEST_TMP/config-authority.log"
grep -q "Release root: $RELEASE_ROOT" "$TEST_TMP/config-authority.log" ||
    fail "environment variables overrode server config values"
pass "server config values override inherited environment variables"

chmod 0775 "$RELEASE_ROOT/releases"
expect_failure "layout rejects a group-writable releases directory" \
    "$DEPLOY_HELPER" check --sha "$SHA_A" --artifact "$ARTIFACT_A" --config "$CONFIG"
chmod 0755 "$RELEASE_ROOT/releases"

chmod 0770 "$RELEASE_ROOT/.staging"
expect_failure "layout rejects a group-writable staging directory" \
    "$DEPLOY_HELPER" check --sha "$SHA_A" --artifact "$ARTIFACT_A" --config "$CONFIG"
chmod 0700 "$RELEASE_ROOT/.staging"

chmod 0664 "$ARTIFACT_A"
expect_failure "artifact verification rejects a group-writable archive" \
    "$DEPLOY_HELPER" check --sha "$SHA_A" --artifact "$ARTIFACT_A" --config "$CONFIG"
chmod 0644 "$ARTIFACT_A"

chmod 0660 "$CONFIG"
expect_failure "config loading rejects group-writable configuration" \
    "$DEPLOY_HELPER" check --sha "$SHA_A" --artifact "$ARTIFACT_A" --config "$CONFIG"
chmod 0600 "$CONFIG"

if [[ $(id -u) != 0 ]]; then
    expect_failure "artifact verification rejects a path owned by another user" \
        "$DEPLOY_HELPER" check --sha "$SHA_A" --artifact /etc/hosts --config "$CONFIG"
fi

mkdir "$RELEASE_ROOT/.deploy.lock"
expect_failure "deploy refuses to overlap an existing server deployment lock" \
    "$DEPLOY_HELPER" deploy --sha "$SHA_A" --artifact "$ARTIFACT_A" --config "$CONFIG"
rmdir "$RELEASE_ROOT/.deploy.lock"

BROKEN_CANDIDATE_ROOT=$TEST_TMP/broken-candidate-production
BROKEN_CANDIDATE_CONFIG=$TEST_TMP/broken-candidate.conf
mkdir -p "$BROKEN_CANDIDATE_ROOT/releases" "$BROKEN_CANDIDATE_ROOT/.staging"
chmod 0755 "$BROKEN_CANDIDATE_ROOT" "$BROKEN_CANDIDATE_ROOT/releases"
chmod 0700 "$BROKEN_CANDIDATE_ROOT/.staging"
cat >"$BROKEN_CANDIDATE_CONFIG" <<EOF
RADDAD_RELEASE_ROOT=$BROKEN_CANDIDATE_ROOT
RADDAD_SITE_URL=https://raddadband.example
RADDAD_RETENTION_COUNT=5
RADDAD_HEALTH_ATTEMPTS=1
RADDAD_HEALTH_DELAY_SECONDS=0
EOF
chmod 0600 "$BROKEN_CANDIDATE_CONFIG"
ln -s "releases/$SHA_G" "$BROKEN_CANDIDATE_ROOT/current"
expect_failure "prepare refuses to reveal a missing candidate through current" \
    "$DEPLOY_HELPER" prepare --sha "$SHA_G" --artifact "$ARTIFACT_G" \
    --config "$BROKEN_CANDIDATE_CONFIG"
[[ -L $BROKEN_CANDIDATE_ROOT/current &&
   ! -e $BROKEN_CANDIDATE_ROOT/current &&
   ! -e $BROKEN_CANDIDATE_ROOT/releases/$SHA_G ]] ||
    fail "prepare published a candidate through an existing broken current link"
expect_failure "deploy refuses to reveal a missing candidate through current" \
    "$DEPLOY_HELPER" deploy --sha "$SHA_G" --artifact "$ARTIFACT_G" \
    --config "$BROKEN_CANDIDATE_CONFIG"
[[ -L $BROKEN_CANDIDATE_ROOT/current &&
   ! -e $BROKEN_CANDIDATE_ROOT/current &&
   ! -e $BROKEN_CANDIDATE_ROOT/releases/$SHA_G ]] ||
    fail "deploy published a candidate through an existing broken current link"

CAS_ROOT=$TEST_TMP/cas-production
CAS_CONFIG=$TEST_TMP/cas-raddad-deploy.conf
mkdir -p "$CAS_ROOT/releases" "$CAS_ROOT/.staging"
chmod 0755 "$CAS_ROOT" "$CAS_ROOT/releases"
chmod 0700 "$CAS_ROOT/.staging"
cat >"$CAS_CONFIG" <<EOF
RADDAD_RELEASE_ROOT=$CAS_ROOT
RADDAD_SITE_URL=https://raddadband.example
RADDAD_RETENTION_COUNT=5
RADDAD_HEALTH_ATTEMPTS=1
RADDAD_HEALTH_DELAY_SECONDS=0
EOF
chmod 0600 "$CAS_CONFIG"
"$DEPLOY_HELPER" prepare --sha "$SHA_A" --artifact "$ARTIFACT_A" \
    --config "$CAS_CONFIG" >"$TEST_TMP/cas-prepare-a.log"
ln -s "releases/$SHA_A" "$CAS_ROOT/current"

BLOCK_STARTED=$TEST_TMP/cas-activation-started
BLOCK_RELEASE=$TEST_TMP/cas-activation-release
MOCK_RELEASE_ROOT=$CAS_ROOT \
MOCK_HEALTH=block-sha \
MOCK_BLOCK_SHA=$SHA_A \
MOCK_BLOCK_STARTED=$BLOCK_STARTED \
MOCK_BLOCK_RELEASE=$BLOCK_RELEASE \
    "$DEPLOY_HELPER" deploy --sha "$SHA_B" --artifact "$ARTIFACT_B" \
    --config "$CAS_CONFIG" >"$TEST_TMP/cas-activation.log" 2>&1 &
cas_pid=$!
wait_for_file "$BLOCK_STARTED" "pre-activation current snapshot check"
replace_current "$CAS_ROOT" "$SHA_A"
: >"$BLOCK_RELEASE"
if wait "$cas_pid"; then
    fail "deployment overwrote a current link changed before activation"
fi
[[ $(readlink "$CAS_ROOT/current") = "releases/$SHA_A" ]] ||
    fail "activation compare-and-swap did not preserve the operator's current link"
if grep -qx "$SHA_B" "$CAS_ROOT/.known-good"; then
    fail "activation-raced candidate was recorded as known-good"
fi
pass "activation refuses to overwrite a concurrently replaced current link"

"$DEPLOY_HELPER" prepare --sha "$SHA_G" --artifact "$ARTIFACT_SLOW" \
    --config "$CAS_CONFIG" >"$TEST_TMP/cas-prepare-race.log" 2>&1 &
prepare_pid=$!
wait_for_staging "$CAS_ROOT" "$SHA_G" "$prepare_pid" "prepare current-change race"
kill -STOP "$prepare_pid"
replace_current "$CAS_ROOT" "$SHA_A"
kill -CONT "$prepare_pid"
if wait "$prepare_pid"; then
    fail "prepare published a release after current changed during installation"
fi
[[ $(readlink "$CAS_ROOT/current") = "releases/$SHA_A" ]] ||
    fail "prepare current-snapshot check changed the operator's current link"
[[ ! -e $CAS_ROOT/releases/$SHA_G ]] ||
    fail "prepare current-snapshot check left the candidate published"
pass "prepare refuses publication when current changes during installation"

LEGACY_ROOT=$TEST_TMP/legacy-production
LEGACY_CONFIG=$TEST_TMP/legacy-raddad-deploy.conf
mkdir -p \
    "$LEGACY_ROOT/releases/$SHA_H" \
    "$LEGACY_ROOT/releases/$SHA_I" \
    "$LEGACY_ROOT/.staging"
chmod 0755 \
    "$LEGACY_ROOT" \
    "$LEGACY_ROOT/releases" \
    "$LEGACY_ROOT/releases/$SHA_H" \
    "$LEGACY_ROOT/releases/$SHA_I"
chmod 0700 "$LEGACY_ROOT/.staging"
tar -xzf "$ARTIFACT_LEGACY" -C "$LEGACY_ROOT/releases/$SHA_H"
tar -xzf "$ARTIFACT_LEGACY_UNSAFE" -C "$LEGACY_ROOT/releases/$SHA_I"
find "$LEGACY_ROOT/releases" -type d -exec chmod 0755 {} +
find "$LEGACY_ROOT/releases" -type f -exec chmod 0644 {} +
cat >"$LEGACY_CONFIG" <<EOF
RADDAD_RELEASE_ROOT=$LEGACY_ROOT
RADDAD_SITE_URL=https://raddadband.example
RADDAD_RETENTION_COUNT=5
RADDAD_HEALTH_ATTEMPTS=1
RADDAD_HEALTH_DELAY_SECONDS=0
EOF
chmod 0600 "$LEGACY_CONFIG"
printf '%s\n%s\n' "$SHA_H" "$SHA_I" >"$LEGACY_ROOT/.known-good"
chmod 0640 "$LEGACY_ROOT/.known-good"
expect_failure "list requires exact 0600 permissions on known-good state" \
    "$DEPLOY_HELPER" list --config "$LEGACY_CONFIG"
chmod 0600 "$LEGACY_ROOT/.known-good"

"$DEPLOY_HELPER" list --config "$LEGACY_CONFIG" >"$TEST_TMP/list-legacy.log"
grep -q "^${SHA_H}[[:space:]]HEALTHY[[:space:]]INACTIVE$" \
    "$TEST_TMP/list-legacy.log" ||
    fail "list rejected a checksum-valid retained historical inventory"
grep -q "^${SHA_I}[[:space:]]BROKEN[[:space:]]INACTIVE$" \
    "$TEST_TMP/list-legacy.log" ||
    fail "list accepted an unsafe retained asset path"
pass "retained releases are schema-driven while unsafe URL paths remain rejected"

ln -s ../outside "$LEGACY_ROOT/current"
"$DEPLOY_HELPER" list --config "$LEGACY_CONFIG" >"$TEST_TMP/list-invalid-current.log"
grep -q "^CURRENT[[:space:]]invalid-symlink$" "$TEST_TMP/list-invalid-current.log" ||
    fail "list did not report an out-of-tree current symlink safely"
pass "list tolerates and reports an invalid current symlink"
MOCK_RELEASE_ROOT=$LEGACY_ROOT MOCK_HEALTH=success \
    "$DEPLOY_HELPER" rollback --sha "$SHA_H" --config "$LEGACY_CONFIG" \
    >"$TEST_TMP/rollback-invalid-current.log"
[[ $(readlink "$LEGACY_ROOT/current") = "releases/$SHA_H" ]] ||
    fail "rollback did not atomically replace the invalid current symlink"
pass "rollback recovers from an invalid current symlink"

rm -f "$LEGACY_ROOT/current"
printf 'operator-owned sentinel\n' >"$LEGACY_ROOT/current"
"$DEPLOY_HELPER" list --config "$LEGACY_CONFIG" >"$TEST_TMP/list-unsafe-current.log"
grep -q "^CURRENT[[:space:]]unsafe-current$" "$TEST_TMP/list-unsafe-current.log" ||
    fail "list did not report a non-symlink current entry safely"
expect_failure "rollback fails closed for a non-symlink current entry" \
    "$DEPLOY_HELPER" rollback --sha "$SHA_H" --config "$LEGACY_CONFIG"
replace_current "$LEGACY_ROOT" "$SHA_H"

"$DEPLOY_HELPER" prepare --sha "$SHA_A" --artifact "$ARTIFACT_A" --config "$CONFIG" \
    >"$TEST_TMP/prepare-a.log"
[[ -d $RELEASE_ROOT/releases/$SHA_A ]] ||
    fail "prepare did not install the verified release"
[[ ! -e $RELEASE_ROOT/current ]] ||
    fail "prepare changed the current symlink"
grep -q "prepare succeeded for $SHA_A" "$TEST_TMP/prepare-a.log" ||
    fail "prepare did not report success"
pass "prepare installs a verified bootstrap release without changing current"

MOCK_HEALTH=success "$DEPLOY_HELPER" deploy --sha "$SHA_A" \
    --artifact "$ARTIFACT_A" --config "$CONFIG" >"$TEST_TMP/deploy-a.log"
[[ -L $RELEASE_ROOT/current ]] || fail "deploy did not create current symlink"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_A" ]] ||
    fail "deploy activated the wrong release"
[[ -f $RELEASE_ROOT/releases/$SHA_A/index.html ]] ||
    fail "deploy did not install the clean artifact"
[[ ! -e $RELEASE_ROOT/releases/$SHA_A/package.json ]] ||
    fail "deploy unexpectedly installed repository files"
grep -q "deploy succeeded for $SHA_A" "$TEST_TMP/deploy-a.log" ||
    fail "deploy did not report success"
pass "deploy installs only the verified artifact and atomically activates it"

printf '{}\n' >"$RELEASE_ROOT/releases/$SHA_A/package.json"
expect_failure "deploy refuses to replace a tampered active release" \
    "$DEPLOY_HELPER" deploy --sha "$SHA_B" --artifact "$ARTIFACT_B" --config "$CONFIG"
rm -f "$RELEASE_ROOT/releases/$SHA_A/package.json"

grep -qx "$SHA_A" "$RELEASE_ROOT/.known-good" ||
    fail "successful deployment was not recorded as known-good"
"$DEPLOY_HELPER" list --config "$CONFIG" >"$TEST_TMP/list-a.log"
grep -q "^${SHA_A}[[:space:]]HEALTHY[[:space:]]CURRENT$" "$TEST_TMP/list-a.log" ||
    fail "list did not identify the active known-good release"
pass "successful public health is recorded and safely listed"

MOCK_HEALTH=corrupt-path MOCK_FAIL_SHA=$SHA_B MOCK_FAIL_PATH=index.html \
    expect_failure "homepage byte mismatch fails deployment health" \
    "$DEPLOY_HELPER" deploy --sha "$SHA_B" --artifact "$ARTIFACT_B" --config "$CONFIG"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_A" ]] ||
    fail "homepage health failure did not restore previous current"
[[ -d $RELEASE_ROOT/releases/$SHA_B ]] ||
    fail "failed release should remain available for diagnosis"
if grep -qx "$SHA_B" "$RELEASE_ROOT/.known-good"; then
    fail "health-failed release was recorded as known-good"
fi
pass "homepage health failure restores the previous known-good release"

MOCK_HEALTH=fail-path MOCK_FAIL_SHA=$SHA_B \
MOCK_FAIL_PATH=assets/rad-dad-social-2026.png \
    expect_failure "any published asset failure fails deployment health" \
    "$DEPLOY_HELPER" deploy --sha "$SHA_B" --artifact "$ARTIFACT_B" --config "$CONFIG"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_A" ]] ||
    fail "asset health failure did not restore previous current"
pass "all-file asset health restores the previous known-good release"

"$DEPLOY_HELPER" list --config "$CONFIG" >"$TEST_TMP/list-failed-b.log"
grep -q "^${SHA_B}[[:space:]]INSTALLED-UNHEALTHY[[:space:]]INACTIVE$" \
    "$TEST_TMP/list-failed-b.log" ||
    fail "list did not distinguish the failed installed release"
expect_failure "rollback rejects an installed release that never passed public health" \
    "$DEPLOY_HELPER" rollback --sha "$SHA_B" --config "$CONFIG"

MOCK_HEALTH=success "$DEPLOY_HELPER" deploy --sha "$SHA_C" \
    --artifact "$ARTIFACT_C" --config "$CONFIG" >"$TEST_TMP/deploy-c.log"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_C" ]] ||
    fail "deploy did not activate the second healthy release"
[[ ! -e $RELEASE_ROOT/releases/$SHA_B ]] ||
    fail "failed installed release survived the next successful retention pass"
grep -qx "$SHA_C" "$RELEASE_ROOT/.known-good" ||
    fail "second healthy release was not recorded"
pass "failed releases do not displace known-good rollback history"

MOCK_HEALTH=success "$DEPLOY_HELPER" rollback --sha "$SHA_A" --config "$CONFIG" \
    >"$TEST_TMP/rollback-a.log"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_A" ]] ||
    fail "manual rollback did not activate the selected known-good release"
pass "rollback validates and activates a recorded known-good release"

MOCK_HEALTH=corrupt-path MOCK_FAIL_SHA=$SHA_C MOCK_FAIL_PATH=script.js \
    expect_failure "failed rollback health check reports failure" \
    "$DEPLOY_HELPER" rollback --sha "$SHA_C" --config "$CONFIG"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_A" ]] ||
    fail "failed rollback health check did not restore original current"
pass "failed rollback health check restores the original current release"

printf '{}\n' >"$RELEASE_ROOT/releases/$SHA_A/package.json"
MOCK_HEALTH=fail-path MOCK_FAIL_SHA=$SHA_C MOCK_FAIL_PATH=styles.css \
    expect_failure "failed rollback from a tampered current reports failure" \
    "$DEPLOY_HELPER" rollback --sha "$SHA_C" --config "$CONFIG"
[[ ! -e $RELEASE_ROOT/current && ! -L $RELEASE_ROOT/current ]] ||
    fail "failed rollback restored or retained the invalid prior release"
rm -f "$RELEASE_ROOT/releases/$SHA_A/package.json"
pass "failed rollback never restores an invalid prior release"

MOCK_HEALTH=success "$DEPLOY_HELPER" rollback --sha "$SHA_C" --config "$CONFIG" \
    >"$TEST_TMP/rollback-missing-current.log"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_C" ]] ||
    fail "rollback did not recover a missing current link"
pass "rollback recovers when current is missing"

printf '{}\n' >"$RELEASE_ROOT/releases/$SHA_C/package.json"
"$DEPLOY_HELPER" list --config "$CONFIG" >"$TEST_TMP/list-broken-c.log"
grep -q "^${SHA_C}[[:space:]]BROKEN[[:space:]]CURRENT$" "$TEST_TMP/list-broken-c.log" ||
    fail "list did not report checksum-broken current release"
MOCK_HEALTH=success "$DEPLOY_HELPER" rollback --sha "$SHA_A" --config "$CONFIG" \
    >"$TEST_TMP/rollback-tampered-current.log"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_A" ]] ||
    fail "rollback did not replace a tampered active release"
[[ ! -e $RELEASE_ROOT/releases/$SHA_C ]] ||
    fail "checksum-broken known-good release survived retention"
if grep -qx "$SHA_C" "$RELEASE_ROOT/.known-good"; then
    fail "checksum-broken release still consumed a known-good retention slot"
fi
rm -f "$RELEASE_ROOT/releases/$SHA_C/package.json"
pass "rollback replaces a tampered current and prunes broken known-good state"

MOCK_HEALTH=success "$DEPLOY_HELPER" deploy --sha "$SHA_C" \
    --artifact "$ARTIFACT_C" --config "$CONFIG" >"$TEST_TMP/redeploy-c.log"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_C" ]] ||
    fail "healthy release was not re-established after pruning the broken copy"

rm -f "$RELEASE_ROOT/current"
ln -s "releases/$SHA_D" "$RELEASE_ROOT/current"
MOCK_HEALTH=success "$DEPLOY_HELPER" rollback --sha "$SHA_C" --config "$CONFIG" \
    >"$TEST_TMP/rollback-broken-current.log"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_C" ]] ||
    fail "rollback did not replace a broken current link"
pass "rollback recovers from a broken current symlink"

BLOCK_STARTED=$TEST_TMP/signal-restore-started
BLOCK_RELEASE=$TEST_TMP/signal-restore-release
SIGNAL_FIFO=$TEST_TMP/signal-restore.fifo
mkfifo "$SIGNAL_FIFO"
cat "$SIGNAL_FIFO" >"$TEST_TMP/signal-restore.log" &
signal_reader_pid=$!
MOCK_HEALTH=block-sha \
MOCK_BLOCK_SHA=$SHA_D \
MOCK_BLOCK_STARTED=$BLOCK_STARTED \
MOCK_BLOCK_RELEASE=$BLOCK_RELEASE \
    "$DEPLOY_HELPER" deploy --sha "$SHA_D" --artifact "$ARTIFACT_D" --config "$CONFIG" \
    >"$SIGNAL_FIFO" 2>&1 &
signal_pid=$!
wait_for_file "$BLOCK_STARTED" "signal restoration health check"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_D" ]] ||
    fail "signal test did not reach candidate activation"
kill -TERM "$signal_reader_pid"
wait "$signal_reader_pid" 2>/dev/null || true
kill -TERM "$signal_pid"
kill -TERM "$signal_pid" 2>/dev/null || true
: >"$BLOCK_RELEASE"
if wait "$signal_pid"; then
    fail "signaled deployment unexpectedly succeeded"
else
    signal_status=$?
fi
[[ "$signal_status" == "143" ]] ||
    fail "signaled deployment returned $signal_status instead of 143"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_C" ]] ||
    fail "abnormal exit did not restore the prior known-good release"
[[ ! -e $RELEASE_ROOT/.deploy.lock ]] ||
    fail "abnormal exit left the deployment lock behind"
if grep -qx "$SHA_D" "$RELEASE_ROOT/.known-good"; then
    fail "interrupted candidate was recorded as known-good"
fi
pass "repeated signals and disconnected output preserve activation restoration"

BLOCK_STARTED=$TEST_TMP/signal-concurrent-started
BLOCK_RELEASE=$TEST_TMP/signal-concurrent-release
MOCK_HEALTH=block-sha \
MOCK_BLOCK_SHA=$SHA_E \
MOCK_BLOCK_STARTED=$BLOCK_STARTED \
MOCK_BLOCK_RELEASE=$BLOCK_RELEASE \
    "$DEPLOY_HELPER" deploy --sha "$SHA_E" --artifact "$ARTIFACT_E" --config "$CONFIG" \
    >"$TEST_TMP/signal-concurrent.log" 2>&1 &
signal_pid=$!
wait_for_file "$BLOCK_STARTED" "concurrent current-change health check"
replace_current "$RELEASE_ROOT" "$SHA_A"
kill -TERM "$signal_pid"
: >"$BLOCK_RELEASE"
if wait "$signal_pid"; then
    fail "concurrently changed signaled deployment unexpectedly succeeded"
else
    signal_status=$?
fi
[[ "$signal_status" == "143" ]] ||
    fail "concurrent signal test returned $signal_status instead of 143"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_A" ]] ||
    fail "abnormal cleanup clobbered a concurrently changed current"
pass "abnormal cleanup does not clobber a concurrently changed current"

FIRST_ROOT=$TEST_TMP/first-production
FIRST_CONFIG=$TEST_TMP/first-raddad-deploy.conf
mkdir -p "$FIRST_ROOT/releases" "$FIRST_ROOT/.staging"
chmod 0755 "$FIRST_ROOT" "$FIRST_ROOT/releases"
chmod 0700 "$FIRST_ROOT/.staging"
cat >"$FIRST_CONFIG" <<EOF
RADDAD_RELEASE_ROOT=$FIRST_ROOT
RADDAD_SITE_URL=https://raddadband.example
RADDAD_RETENTION_COUNT=5
RADDAD_HEALTH_ATTEMPTS=1
RADDAD_HEALTH_DELAY_SECONDS=0
EOF
chmod 0600 "$FIRST_CONFIG"
BLOCK_STARTED=$TEST_TMP/signal-first-started
BLOCK_RELEASE=$TEST_TMP/signal-first-release
MOCK_RELEASE_ROOT=$FIRST_ROOT \
MOCK_HEALTH=block-sha \
MOCK_BLOCK_SHA=$SHA_G \
MOCK_BLOCK_STARTED=$BLOCK_STARTED \
MOCK_BLOCK_RELEASE=$BLOCK_RELEASE \
    "$DEPLOY_HELPER" deploy --sha "$SHA_G" --artifact "$ARTIFACT_G" --config "$FIRST_CONFIG" \
    >"$TEST_TMP/signal-first.log" 2>&1 &
signal_pid=$!
wait_for_file "$BLOCK_STARTED" "first-release signal health check"
kill -TERM "$signal_pid"
: >"$BLOCK_RELEASE"
if wait "$signal_pid"; then
    fail "signaled first deployment unexpectedly succeeded"
else
    signal_status=$?
fi
[[ "$signal_status" == "143" ]] ||
    fail "signaled first deployment returned $signal_status instead of 143"
[[ ! -e $FIRST_ROOT/current && ! -L $FIRST_ROOT/current ]] ||
    fail "abnormal first deployment left current active"
pass "signal after first activation removes the unverified current link"

CONFIG_RETENTION=$TEST_TMP/raddad-retention-two.conf
cat >"$CONFIG_RETENTION" <<EOF
RADDAD_RELEASE_ROOT=$RELEASE_ROOT
RADDAD_SITE_URL=https://raddadband.example
RADDAD_RETENTION_COUNT=2
RADDAD_HEALTH_ATTEMPTS=1
RADDAD_HEALTH_DELAY_SECONDS=0
EOF
chmod 0600 "$CONFIG_RETENTION"

BLOCK_STARTED=$TEST_TMP/retention-current-change-started
BLOCK_RELEASE=$TEST_TMP/retention-current-change-release
MOCK_RELEASE_ROOT=$RELEASE_ROOT \
MOCK_HEALTH=block-after-path \
MOCK_BLOCK_SHA=$SHA_F \
MOCK_BLOCK_PATH=version.json \
MOCK_BLOCK_STARTED=$BLOCK_STARTED \
MOCK_BLOCK_RELEASE=$BLOCK_RELEASE \
    "$DEPLOY_HELPER" deploy --sha "$SHA_F" --artifact "$ARTIFACT_F" \
    --config "$CONFIG_RETENTION" >"$TEST_TMP/retention-current-change.log" 2>&1 &
retention_pid=$!
wait_for_file "$BLOCK_STARTED" "final successful health response"
retention_releases_before=$(find "$RELEASE_ROOT/releases" -print | LC_ALL=C sort)
replace_current "$RELEASE_ROOT" "$SHA_C"
: >"$BLOCK_RELEASE"
if wait "$retention_pid"; then
    fail "retention continued after current changed during final health"
fi
retention_releases_after=$(find "$RELEASE_ROOT/releases" -print | LC_ALL=C sort)
[[ "$retention_releases_before" == "$retention_releases_after" ]] ||
    fail "retention deleted a release after current changed"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_C" &&
   -d $RELEASE_ROOT/releases/$SHA_C ]] ||
    fail "retention removed or replaced the operator-selected live release"
if grep -qx "$SHA_F" "$RELEASE_ROOT/.known-good"; then
    fail "current-raced candidate was recorded as known-good"
fi
pass "retention aborts without deletion when current changes during final health"
replace_current "$RELEASE_ROOT" "$SHA_A"

MOCK_HEALTH=success "$DEPLOY_HELPER" deploy --sha "$SHA_F" \
    --artifact "$ARTIFACT_F" --config "$CONFIG_RETENTION" >"$TEST_TMP/deploy-f.log"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_F" ]] ||
    fail "retention test did not activate the newest release"
[[ -d $RELEASE_ROOT/releases/$SHA_A ]] ||
    fail "retention removed the previous known-good release"
[[ ! -e $RELEASE_ROOT/releases/$SHA_C ]] ||
    fail "retention did not remove the older known-good release"
[[ ! -e $RELEASE_ROOT/releases/$SHA_D && ! -e $RELEASE_ROOT/releases/$SHA_E ]] ||
    fail "failed/interrupted releases displaced healthy rollback history"
"$DEPLOY_HELPER" list --config "$CONFIG_RETENTION" >"$TEST_TMP/list-retained.log"
[[ $(grep -c "HEALTHY" "$TEST_TMP/list-retained.log") == 2 ]] ||
    fail "known-good list did not follow the retention count"
pass "retention keeps healthy history and removes failed installed releases"

ACTUAL_SHA=$(git -C "$PROJECT_ROOT" rev-parse --verify 'HEAD^{commit}')
ACTUAL_TIMESTAMP=$(git -C "$PROJECT_ROOT" show -s --format=%cI "$ACTUAL_SHA")
ACTUAL_ARTIFACT=$TEST_TMP/actual-production-artifact.tar.gz
DEPLOY_COMMIT_SHA=$ACTUAL_SHA BUILD_TIMESTAMP=$ACTUAL_TIMESTAMP \
    npm --prefix "$PROJECT_ROOT" run build:production >"$TEST_TMP/actual-build.log"
COPYFILE_DISABLE=1 tar -C "$PROJECT_ROOT/dist/client" -czf "$ACTUAL_ARTIFACT" .
"$DEPLOY_HELPER" check --sha "$ACTUAL_SHA" --artifact "$ACTUAL_ARTIFACT" \
    --config "$CONFIG" >"$TEST_TMP/actual-check.log"
grep -q "Dry run passed for $ACTUAL_SHA" "$TEST_TMP/actual-check.log" ||
    fail "the workflow-shaped production tar did not pass the server verifier"
pass "the real clean dist/client tar passes the server-side dry run"

printf '1..%d\n' "$PASS_COUNT"
