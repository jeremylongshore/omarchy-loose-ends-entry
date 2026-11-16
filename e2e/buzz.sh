#!/usr/bin/env bash
# Acceptance lane for the real production-parity Omarchy shell.
# RTM: REQ-LE-008, REQ-LE-009
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/rig-verify.sh" "$ROOT"
"$ROOT/scripts/rig-render.sh" "$ROOT" "$ROOT/preview.png"
test -s "$ROOT/preview.png"
jq -e '.sourceDirty == false and .sourcePackageSha256 == .remotePackageSha256
  and (.rigVersions.omarchy | test("^[a-f0-9]{40}$"))
  and (.rigVersions.qt | test("^[0-9]+[.][0-9]+"))' \
  "$ROOT/.rig-proof.json" >/dev/null
jq -e '.sourceDirty == false and .sourcePackageSha256 == .remotePackageSha256
  and (.fingerprint | length == 64) and (.previewSha256 | length == 64)
  and .dimensions == "1280 x 720" and .nonblackCoverage >= 0.35
  and (.rigVersions.omarchy | test("^[a-f0-9]{40}$"))
  and (.rigVersions.qt | test("^[0-9]+[.][0-9]+"))
  and .visualInspection.status == "pending"' "$ROOT/.render-proof.json" >/dev/null
