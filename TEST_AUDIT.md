# Test Audit: Loose Ends

Date: 2026-08-30 (first audit). Counts and evidence re-derived: 2026-11-15, for
0.1.2.
Classification: frontend plus bounded local Git scanner
Audit harness: 1.4.0

The scanner and Model.js have strong integration and hostile-path tests. The
2026-08-30 remediation added the marketplace, QML contract, accessibility,
smoke, gate-runner, gate-sync, mutation, audit-harness, and real-shell lanes.
The earlier version of this file said Buzz validation, rendering and approval
were pending because the rig was offline. That is no longer true: the rig
receipts and the preview are regenerated from the 0.1.2 tree (see below).

## Local evidence

- 51/51 tests pass. Model.js is at 100% statements, lines and functions, and
  99.24% branches.
- The active scanner race suite (6 tests) passes three consecutive runs.
- Mutation score is 91.85% against a blocking 90% floor (292 killed, 1 timed
  out, 26 survived). Every survivor is an equivalent mutant: a boundary where
  both sides return the same value, an emptied catch block that falls through
  to the same result, or the CommonJS export guard.
- osv-scanner reports 0 advisories; the hash-pinned audit-harness profile
  verifies, and its deep and scan layers pass.
- ShellCheck and markdownlint are clean. The 13 vendored gates (c28 to c44) pass
  and the lane is in sync with canonical `f79d8c7`.
- Rig (omarchy `74de10479d3bf7aa7865408e33219064cfe45432`, Qt 6.12.0): the
  validator exits 0 with 0 qmllint errors, and the render loads with no QML
  warnings. Both receipts record the Omarchy revision and the Qt version.
- The preview is a render of a fixture of five throwaway repositories, and the
  README says so. Its inspection is recorded as an agent inspection, not a human
  sign-off.

## What is not measured

- Coverage and mutation cover Model.js only. QML and the scanner script are
  covered by contract tests, scanner tests and the rig.
- CRAP is not enforced. Under audit-harness 1.4.0 the crap-score gate scores
  zero functions for a root-level Model.js and still reports PASS
  (jeremylongshore/intent-audit-harness#248).
- The rig's compositor is headless sway, not Hyprland. This plugin calls no
  Hyprland command, so nothing here depends on that difference.
