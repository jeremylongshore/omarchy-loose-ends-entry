# Loose Ends

The Git work you left unfinished, visible as a quiet queue on the Omarchy bar.

Loose Ends scans local repositories under your home directory every five minutes
and shows only work that merits a return: stale uncommitted edits, unpushed
commits, old stashes, detached heads, and interrupted Git operations. The bar
stays out of the way when the queue is empty. Open it to see the oldest work
first and decide what to finish, push, or discard.

It has no network calls, API key, account, daemon, or write access to your
repositories. Git runs with `--no-optional-locks`; this widget only reads.

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

Fresh changes are shown without turning the bar alert color on. Stale work (14+
days) and interrupted operations are emphasized. This is a peripheral reminder,
not a task manager or another source of notifications.

## Development

```bash
npm test
bash scripts/run-plugin-gates.sh
```

The scanner can be run directly while developing:

```bash
bin/loose-ends-scan --max-depth 4 "$HOME"
```

On an Omarchy rig, also run `omarchy-plugin-validate .`, `qmllint *.qml`, and
capture the pill and panel before submitting to the marketplace.

## License

MIT
