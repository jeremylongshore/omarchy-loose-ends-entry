#!/usr/bin/env bash
# Load this plugin into a REAL Omarchy shell on the rig, open its panel, and
# screenshot it.
#
# Why this exists, and why it is separate from rig-verify.sh:
#
#   rig-verify.sh proves the tree passes omarchy-plugin-validate and qmllint.
#   Both are static. Neither loads the plugin, so neither can see a contract
#   error: Bazaar shipped a PanelWindow where the first-party popup is a
#   KeyboardPanel, passed every gate AND qmllint, and only a running shell said
#   "Cannot assign to non-existent property contentHeight".
#
#   Until this script existed, every plugin here was submitted having never been
#   loaded. The repos' own VERIFICATION.md files said so in as many words: "the
#   plugin has not been loaded into a running Omarchy shell ... that is
#   provenance, not a rig run".
#
# It also produces the preview.png the marketplace listing shows, from a real
# render rather than a mockup.
#
# Requires: ssh access to the rig host, and a headless compositor running there.
# It starts sway on the headless wlroots backend if one is not already up.
#
# Usage: scripts/rig-render.sh [plugin-dir] [out.png]
set -uo pipefail

TARGET="$(cd "${1:-$(dirname "$0")/..}" && pwd)"
OUT="${2:-$TARGET/render.png}"
HOST="${OMARCHY_RIG_HOST:-intent-ops-buzz}"
CONTAINER="${OMARCHY_RIG_CONTAINER:-omarchy-rig}"
RES="${OMARCHY_RIG_RESOLUTION:-1920x1200}"

command -v jq >/dev/null 2>&1 || { echo "rig-render: jq is required" >&2; exit 2; }
[[ -f "$TARGET/manifest.json" ]] || { echo "rig-render: no manifest.json in $TARGET" >&2; exit 2; }

MOD="$(jq -r '.id // empty' "$TARGET/manifest.json")"
[[ -n "$MOD" ]] || { echo "rig-render: manifest.json has no id" >&2; exit 2; }
NAME="${MOD##*.}"

TGZ="$(mktemp -t rigrender-XXXXXX.tgz)"
trap 'rm -f "$TGZ"' EXIT
# tests/ and scripts/ are not shipped to a user, so they are not shipped here.
tar czf "$TGZ" -C "$TARGET" --exclude=.git --exclude=tests --exclude=scripts --exclude=node_modules . || {
  echo "rig-render: could not package the tree" >&2; exit 2; }

echo "rig-render: shipping $NAME to $HOST/$CONTAINER"
scp -q "$TGZ" "$HOST:/tmp/rigrender.tgz" || { echo "rig-render: cannot reach $HOST" >&2; exit 2; }

# The remote body is written to a file rather than inlined, because nesting
# quotes through ssh -> docker exec -> sh mangles them and fails silently.
REMOTE="$(mktemp -t rigrender-XXXXXX.sh)"
trap 'rm -f "$TGZ" "$REMOTE"' EXIT
cat > "$REMOTE" <<REMOTE_EOF
#!/bin/sh
set -eu
MOD="$MOD"; NAME="$NAME"; RES="$RES"
export XDG_RUNTIME_DIR=/tmp/xdgrt
mkdir -p \$XDG_RUNTIME_DIR; chmod 700 \$XDG_RUNTIME_DIR

# Start a headless compositor only if one is not already serving.
if [ ! -e "\$XDG_RUNTIME_DIR/wayland-1" ]; then
  WLR_BACKENDS=headless WLR_LIBINPUT_NO_DEVICES=1 WLR_RENDERER=pixman sway >/tmp/sway.log 2>&1 &
  sleep 6
fi
export WAYLAND_DISPLAY=wayland-1
export SWAYSOCK=\$(ls \$XDG_RUNTIME_DIR/sway-ipc.*.sock 2>/dev/null | head -1)
swaymsg output HEADLESS-1 resolution "\$RES" >/dev/null 2>&1

pkill -f 'qs -p' 2>/dev/null; sleep 1
# Purge EVERY directory that declares this module id, not just the one matching
# our folder name. The rig accumulates installs from earlier runs and from the
# omarchy CLI, which names its folder after the full id; a stale copy of the
# same plugin then shadows the fresh one and the render shows old code while
# reporting success. That cost a full debugging cycle: a redesign appeared not
# to render at all because a directory named "pitwall" was still serving the
# previous build alongside "pit-wall".
for d in /root/.config/omarchy/plugins/*/; do
  [ -f "\$d/manifest.json" ] || continue
  if grep -q "\"\$MOD\"" "\$d/manifest.json" 2>/dev/null; then rm -rf "\$d"; fi
done
rm -rf /root/.config/omarchy/plugins/\$NAME
mkdir -p /root/.config/omarchy/plugins/\$NAME
tar xzf /tmp/rigrender.tgz -C /root/.config/omarchy/plugins/\$NAME

# Build a local four-repository story for this plugin's evidence image. The
# real scanner and real Git commands run against these disposable fixtures.
FIXTURE_ROOT=/tmp/loose-ends-fixtures
if [ -d "\$FIXTURE_ROOT" ]; then find "\$FIXTURE_ROOT" -depth -delete; fi
mkdir -p "\$FIXTURE_ROOT"
make_repo() {
  repo="\$1"
  mkdir -p "\$repo"
  git init -q "\$repo"
  git -C "\$repo" config user.email fixture@example.invalid
  git -C "\$repo" config user.name 'Rig Fixture'
  printf base > "\$repo/tracked.txt"
  git -C "\$repo" add tracked.txt
  git -C "\$repo" commit -qm initial
}

make_repo "\$FIXTURE_ROOT/release-train"
git -C "\$FIXTURE_ROOT/release-train" rev-parse HEAD > "\$FIXTURE_ROOT/release-train/.git/MERGE_HEAD"

make_repo "\$FIXTURE_ROOT/client-redesign"
printf changed > "\$FIXTURE_ROOT/client-redesign/tracked.txt"
touch -d '18 days ago' "\$FIXTURE_ROOT/client-redesign/tracked.txt"

make_repo "\$FIXTURE_ROOT/api-migration"
git init --bare -q "\$FIXTURE_ROOT/api-remote.git"
git -C "\$FIXTURE_ROOT/api-migration" remote add origin "\$FIXTURE_ROOT/api-remote.git"
git -C "\$FIXTURE_ROOT/api-migration" push -qu origin HEAD
api_branch=\$(git -C "\$FIXTURE_ROOT/api-migration" symbolic-ref --short HEAD)
git -C "\$FIXTURE_ROOT/api-migration" branch --set-upstream-to="origin/\$api_branch" >/dev/null
printf second > "\$FIXTURE_ROOT/api-migration/tracked.txt"
git -C "\$FIXTURE_ROOT/api-migration" add tracked.txt
ahead_date=\$(date -d '9 days ago' '+%Y-%m-%dT%H:%M:%S%z')
GIT_AUTHOR_DATE="\$ahead_date" GIT_COMMITTER_DATE="\$ahead_date" \
  git -C "\$FIXTURE_ROOT/api-migration" commit -qm 'local migration'

make_repo "\$FIXTURE_ROOT/forgotten-stash"
printf deferred > "\$FIXTURE_ROOT/forgotten-stash/tracked.txt"
stash_date=\$(date -d '20 days ago' '+%Y-%m-%dT%H:%M:%S%z')
GIT_AUTHOR_DATE="\$stash_date" GIT_COMMITTER_DATE="\$stash_date" \
  git -C "\$FIXTURE_ROOT/forgotten-stash" stash push -qm 'deferred cleanup'

export OMARCHY_LOOSE_ENDS_ROOT="\$FIXTURE_ROOT"

mkdir -p /root/.config/omarchy
cat > /root/.config/omarchy/shell.json <<JSON
{"version":1,"bar":{"position":"top","transparent":false,"centerAnchor":"omarchy.clock",
"layout":{"left":[{"id":"omarchy.workspaces"}],
"center":[{"id":"omarchy.clock","format":"dddd HH:mm"}],
"right":[{"id":"\$MOD"}]}},"plugins":["\$MOD"]}
JSON

qs -p /root/omarchy/shell >/tmp/qs-render.log 2>&1 &
sleep 18

echo "===QML WARNINGS==="
# libEGL/MESA/ZINK noise is the headless software renderer, not the plugin.
grep -a -iE "cannot assign|is not a type|unable to|no such|ERROR" /tmp/qs-render.log \
  | grep -av libEGL | grep -av MESA | grep -av ZINK | head -10

qs -p /root/omarchy/shell ipc call "\$MOD" toggle 2>/dev/null
sleep 6
grim /tmp/rigrender.png 2>/dev/null
echo "===SHOT=== \$(ls -l /tmp/rigrender.png 2>/dev/null | awk '{print \$5}') bytes"
REMOTE_EOF

scp -q "$REMOTE" "$HOST:/tmp/rigrender.sh"
RESULT="$(ssh "$HOST" "docker cp /tmp/rigrender.tgz $CONTAINER:/tmp/ >/dev/null && \
  docker cp /tmp/rigrender.sh $CONTAINER:/tmp/ >/dev/null && \
  docker exec $CONTAINER sh /tmp/rigrender.sh" 2>&1)"

WARNINGS="$(printf '%s' "$RESULT" | sed -n '/===QML WARNINGS===/,/===SHOT===/p' | grep -vE '===' || true)"
SIZE="$(printf '%s' "$RESULT" | grep -oE '===SHOT=== [0-9]+' | grep -oE '[0-9]+' || true)"

if [[ -n "$WARNINGS" ]]; then
  echo "rig-render: the shell reported problems loading this plugin:"
  printf '%s\n' "$WARNINGS" | sed 's/^/  /'
fi

if [[ -z "$SIZE" || "$SIZE" -lt 4000 ]]; then
  echo "rig-render: no usable screenshot came back (size=${SIZE:-none})" >&2
  echo "rig-render: check /tmp/qs-render.log inside the container" >&2
  exit 1
fi

ssh "$HOST" "docker cp $CONTAINER:/tmp/rigrender.png /tmp/rigrender-out.png >/dev/null" || exit 1
scp -q "$HOST:/tmp/rigrender-out.png" "$OUT" || exit 1

echo "rig-render: wrote $OUT (${SIZE} bytes on the rig)"
[[ -n "$WARNINGS" ]] && exit 1
echo "rig-render: loaded clean, no QML warnings"
exit 0
