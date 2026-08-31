# Loose Ends

![Loose Ends banner](assets/banner.svg)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/U5S225PTME)

The Git work you left unfinished, visible as a quiet queue on the Omarchy bar.
Loose Ends scans local repositories under your home directory every five minutes
and shows work worth returning to: stale uncommitted edits, unpushed commits,
old stashes, detached heads, and interrupted Git operations.

It makes no network calls and does not intentionally modify repositories. Every
Git command runs with optional locks disabled, repository-selected hooks and
filesystem monitors disabled, and strict time and output limits. Repository
discovery is bounded before sorting, uses no named temporary file, and reports
when its safety cap makes a scan partial. The panel surfaces interrupted Git
operations urgently, then orders ordinary loose ends oldest first so you can
decide what to finish, push, or discard.

To scan a narrower tree, set `OMARCHY_LOOSE_ENDS_ROOT` in the graphical session
environment before starting the Omarchy shell. The default remains `$HOME`.

## Install

```bash
omarchy plugin add https://github.com/jeremylongshore/omarchy-loose-ends-entry --enable
```

Middle-click the pill to refresh. The plugin also supports the normal Omarchy
panel commands: `open`, `close`, `toggle`, and `refresh`.

## What counts as a loose end

| Signal | Why it appears |
| --- | --- |
| Uncommitted changes | An edit has been sitting long enough to be forgotten. |
| Unpushed commits | Finished locally, not yet safely shared. |
| Old stash | A deferred thought that deserves a decision. |
| Detached HEAD | Easy to lose work after a checkout. |
| Rebase, merge, cherry-pick, bisect | An explicitly interrupted Git operation. |

Fresh changes stay visually quiet. Stale work and interrupted operations are
emphasized. This is a peripheral reminder, not a task manager.

## Verify

```bash
npm test
bash scripts/run-plugin-gates.sh
bash scripts/check-lane-freshness.sh
bash scripts/rig-verify.sh .
bash scripts/rig-render.sh . preview.png
```

## License

MIT
