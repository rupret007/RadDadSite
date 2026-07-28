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

mkdir "$MOCK_BIN"

cat >"$MOCK_BIN/curl" <<'EOF'
#!/usr/bin/env bash
set -u
url=
saw_https_proto=false
for argument in "$@"; do
    [[ "$argument" != "--location" ]] || exit 64
    [[ "$argument" != "=https" ]] || saw_https_proto=true
    url=$argument
done
[[ "$saw_https_proto" == true ]] || exit 64
sha=${url##*v=}
case "${MOCK_HEALTH:-success}" in
    success)
        printf '{"commitSha":"%s"}\n' "$sha"
        ;;
    fail-sha)
        if [[ "$sha" == "${MOCK_FAIL_SHA:-}" ]]; then
            exit 22
        fi
        printf '{"commitSha":"%s"}\n' "$sha"
        ;;
    wrong-sha)
        printf '{"commitSha":"0000000000000000000000000000000000000000"}\n'
        ;;
    *)
        exit 22
        ;;
esac
EOF

chmod +x "$MOCK_BIN/curl"
export PATH=$MOCK_BIN:$PATH

SHA_A=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
SHA_B=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
SHA_C=cccccccccccccccccccccccccccccccccccccccc
ARTIFACT_A="$TEST_TMP/artifact A.tar.gz"
ARTIFACT_B=$TEST_TMP/artifact-b.tar.gz
ARTIFACT_C=$TEST_TMP/artifact-c.tar.gz
ARTIFACT_DUPLICATE=$TEST_TMP/artifact-duplicate-sums.tar.gz
ARTIFACT_CORRUPT=$TEST_TMP/artifact-corrupt.tar.gz
ARTIFACT_TRAVERSAL=$TEST_TMP/artifact-traversal.tar.gz
ARTIFACT_SYMLINK=$TEST_TMP/artifact-symlink.tar.gz
ARTIFACT_UNEXPECTED=$TEST_TMP/artifact-unexpected.tar.gz

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

with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    (root / "index.html").write_text("<!doctype html><title>Rad Dad</title>\n", encoding="utf-8")
    (root / "styles.css").write_text("body { color: white; }\n", encoding="utf-8")
    (root / "script.js").write_text("document.documentElement.dataset.ready = 'true';\n", encoding="utf-8")
    (root / "RadDad_Logo.jpg").write_bytes(b"fixture-logo")
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

    payload_paths = sorted([
        "RadDad_Logo.jpg",
        "index.html",
        "script.js",
        "styles.css",
        "version.json",
    ])
    manifest = {
        "schemaVersion": 1,
        "artifactRoot": "dist/client",
        "commitSha": sha,
        "timestamp": timestamp,
        "files": [details(path) for path in payload_paths],
    }
    (root / "artifact-manifest.json").write_text(
        json.dumps(manifest, separators=(",", ":")) + "\n", encoding="utf-8"
    )

    sum_paths = sorted(["artifact-manifest.json", *payload_paths])
    sums = [
        f"{hashlib.sha256((root / path).read_bytes()).hexdigest()}  {path}"
        for path in sum_paths
    ]
    if variant == "duplicate-sums":
        sums.append(sums[-1])
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
create_artifact "$ARTIFACT_DUPLICATE" "$SHA_C" duplicate-sums
create_artifact "$ARTIFACT_CORRUPT" "$SHA_C" corrupt
create_artifact "$ARTIFACT_TRAVERSAL" "$SHA_C" traversal
create_artifact "$ARTIFACT_SYMLINK" "$SHA_C" symlink
create_artifact "$ARTIFACT_UNEXPECTED" "$SHA_C" unexpected

RELEASE_ROOT=$TEST_TMP/production
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

RADDAD_RELEASE_ROOT=$HOME expect_failure "check rejects the deploy user's home as release root" \
    "$DEPLOY_HELPER" check --sha "$SHA_A" --artifact "$ARTIFACT_A" --config "$CONFIG"

mkdir "$RELEASE_ROOT/.deploy.lock"
expect_failure "deploy refuses to overlap an existing server deployment lock" \
    "$DEPLOY_HELPER" deploy --sha "$SHA_A" --artifact "$ARTIFACT_A" --config "$CONFIG"
rmdir "$RELEASE_ROOT/.deploy.lock"

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

MOCK_HEALTH=fail-sha MOCK_FAIL_SHA=$SHA_B \
    expect_failure "failed deploy health check reports failure" \
    "$DEPLOY_HELPER" deploy --sha "$SHA_B" --artifact "$ARTIFACT_B" --config "$CONFIG"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_A" ]] ||
    fail "failed health check did not restore previous current"
[[ -d $RELEASE_ROOT/releases/$SHA_B ]] ||
    fail "failed release should remain available for diagnosis or explicit rollback"
pass "failed deploy health check restores the previous current release"

MOCK_HEALTH=success "$DEPLOY_HELPER" rollback --sha "$SHA_B" --config "$CONFIG" \
    >"$TEST_TMP/rollback.log"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_B" ]] ||
    fail "manual rollback did not activate the selected installed release"
grep -q "rollback succeeded for $SHA_B" "$TEST_TMP/rollback.log" ||
    fail "manual rollback did not report success"
pass "rollback validates and activates a known installed release"

MOCK_HEALTH=fail-sha MOCK_FAIL_SHA=$SHA_A \
    expect_failure "failed rollback health check reports failure" \
    "$DEPLOY_HELPER" rollback --sha "$SHA_A" --config "$CONFIG"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_B" ]] ||
    fail "failed rollback health check did not restore original current"
pass "failed rollback health check restores the original current release"

RADDAD_RETENTION_COUNT=2 MOCK_HEALTH=success "$DEPLOY_HELPER" deploy \
    --sha "$SHA_C" --artifact "$ARTIFACT_C" --config "$CONFIG" \
    >"$TEST_TMP/deploy-c.log"
[[ $(readlink "$RELEASE_ROOT/current") = "releases/$SHA_C" ]] ||
    fail "retention test did not activate the newest release"
[[ -d $RELEASE_ROOT/releases/$SHA_B ]] ||
    fail "retention removed the previous known-good release"
[[ ! -e $RELEASE_ROOT/releases/$SHA_A ]] ||
    fail "retention did not remove the oldest inactive release"
pass "retention keeps current and previous releases while pruning an older inactive release"

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
