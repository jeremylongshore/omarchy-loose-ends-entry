# Marketplace contract

Loose Ends ships one bar widget whose listing copy and runtime behavior tell the
same product story.

- Root and bar-widget descriptions are identical and exactly 500 characters.
- Copy names the scan cadence, every signal class, interrupted-first priority,
  ordinary oldest-first order, no-network/no-write boundary, bounded reads, and
  explicit partial-scan disclosure.
- `assets/banner.svg` identifies Loose Ends and depicts its local Git queue.
- `preview.png` is accepted only with current-tree Buzz provenance, exact
  1280x720 dimensions, a clean shell-log hash, and visual approval.
- The scanner performs bounded local Git reads and does not modify repositories
  or use the network.

`tests/contract.test.js` and gate C43 enforce the machine-checkable portions.
