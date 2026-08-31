#!/usr/bin/env bash
set -euo pipefail

WORK_ROOT="$HOME/work"
REMOTE_ROOT="$HOME/.rig-remotes"
mkdir -p "$WORK_ROOT" "$REMOTE_ROOT"

new_repo() {
  local repo="$1"
  git init -q -b main "$repo"
  git -C "$repo" config user.name "Omarchy Rig"
  git -C "$repo" config user.email "rig@example.invalid"
  printf '%s\n' "base" > "$repo/tracked.txt"
  git -C "$repo" add tracked.txt
  git -C "$repo" commit -qm "base"
}

MERGE_REPO="$WORK_ROOT/merge-rescue"
new_repo "$MERGE_REPO"
git -C "$MERGE_REPO" checkout -qb feature
printf '%s\n' "feature" > "$MERGE_REPO/tracked.txt"
git -C "$MERGE_REPO" commit -qam "feature change"
git -C "$MERGE_REPO" checkout -q main
printf '%s\n' "main" > "$MERGE_REPO/tracked.txt"
git -C "$MERGE_REPO" commit -qam "main change"
git -C "$MERGE_REPO" merge feature >/dev/null 2>&1 || true
test -f "$MERGE_REPO/.git/MERGE_HEAD"

DIRTY_REPO="$WORK_ROOT/forgotten-refactor"
new_repo "$DIRTY_REPO"
printf '%s\n' "unfinished refactor" > "$DIRTY_REPO/tracked.txt"
touch -d '12 days ago' "$DIRTY_REPO/tracked.txt"

STASH_REPO="$WORK_ROOT/old-experiment"
new_repo "$STASH_REPO"
printf '%s\n' "stashed experiment" > "$STASH_REPO/tracked.txt"
git -C "$STASH_REPO" add tracked.txt
OLD_STASH_DATE=$(date -d '16 days ago' --iso-8601=seconds)
GIT_AUTHOR_DATE="$OLD_STASH_DATE" GIT_COMMITTER_DATE="$OLD_STASH_DATE" \
  git -C "$STASH_REPO" stash push -qm "old experiment"

AHEAD_REPO="$WORK_ROOT/release-notes"
AHEAD_REMOTE="$REMOTE_ROOT/release-notes.git"
new_repo "$AHEAD_REPO"
git init -q --bare "$AHEAD_REMOTE"
git -C "$AHEAD_REPO" remote add origin "$AHEAD_REMOTE"
git -C "$AHEAD_REPO" push -qu origin main
OLD_COMMIT_DATE=$(date -d '9 days ago' --iso-8601=seconds)
printf '%s\n' "release notes ready" >> "$AHEAD_REPO/tracked.txt"
git -C "$AHEAD_REPO" add tracked.txt
GIT_AUTHOR_DATE="$OLD_COMMIT_DATE" GIT_COMMITTER_DATE="$OLD_COMMIT_DATE" \
  git -C "$AHEAD_REPO" commit -qm "finish release notes"

DETACHED_REPO="$WORK_ROOT/detached-investigation"
new_repo "$DETACHED_REPO"
git -C "$DETACHED_REPO" checkout -q --detach HEAD

SCAN_RESULT=$("$PLUGIN_DIR/bin/loose-ends-scan" --max-depth 4 "$WORK_ROOT")
jq -e '.repos | length == 5' <<<"$SCAN_RESULT" >/dev/null
jq -e '.repos | any(.interrupted == "merge")' <<<"$SCAN_RESULT" >/dev/null
jq -e '.repos | any(.dirty > 0)' <<<"$SCAN_RESULT" >/dev/null
jq -e '.repos | any(.ahead > 0)' <<<"$SCAN_RESULT" >/dev/null
jq -e '.repos | any(.staleStash > 0)' <<<"$SCAN_RESULT" >/dev/null
jq -e '.repos | any(.detached == true)' <<<"$SCAN_RESULT" >/dev/null
