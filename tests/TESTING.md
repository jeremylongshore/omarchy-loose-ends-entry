# Testing Loose Ends

Run `npm test` for syntax, unit, integration, QML contract, accessibility, and
smoke coverage. Run `npm run test:race` for three full active scanner-race
passes, `npm run test:mutation` for the 90% blocking Model.js mutation floor,
and `npm run audit` for the pinned audit profile. `npm run test:e2e` is the only
accepted real-shell lane: it must run on Buzz, replace the old preview, produce
current rig/render receipts, and then receive hash-bound human approval.

## What is and is not measured

- Coverage and mutation score Model.js only. QML and the scanner script are
  covered by the contract tests, the scanner tests and the rig.
- CRAP is not enforced. Under audit-harness 1.4.0 the crap-score gate scores
  zero functions for a root-level Model.js and still reports PASS
  (jeremylongshore/intent-audit-harness#248), so this repository has no
  complexity measurement.
- The rig renders under headless sway, not Hyprland. This plugin calls no
  Hyprland command.
- A light theme is checked with `OMARCHY_RIG_THEME=catppuccin-latte
  scripts/rig-render.sh . /tmp/light.png`. That run overwrites
  `.render-proof.json`, so finish with the default render.
