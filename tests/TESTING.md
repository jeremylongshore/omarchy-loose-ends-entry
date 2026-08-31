# Testing Loose Ends

Run `npm test` for syntax, unit, integration, QML contract, accessibility, and
smoke coverage. Run `npm run test:race` for three full active scanner-race
passes, `npm run test:mutation` for the 90% blocking Model.js mutation floor,
and `npm run audit` for the pinned audit profile. `npm run test:e2e` is the only
accepted real-shell lane: it must run on Buzz, replace the old preview, produce
current rig/render receipts, and then receive hash-bound human approval.
