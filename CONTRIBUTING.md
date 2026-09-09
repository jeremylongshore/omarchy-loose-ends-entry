# Contributing

Issues and pull requests are welcome. Keep changes small, evidence-backed, and
compatible with a stock Omarchy installation.

## Choose checks by change

For a documentation-only change, run the portable content gates:

```bash
scripts/run-plugin-gates.sh .
```

For code, tests, manifests, automation, or runtime behavior, run:

```bash
npm ci
npm test
scripts/run-plugin-gates.sh .
```

CI runs additional race, mutation, audit, and shell checks where applicable.
Do not hand-edit `scripts/gates/`; it is synced from Contributing Clanker.

If QML, layout, controls, or graphics change, include a screenshot and describe
what you exercised. Contributors do not need access to the private Buzz rig.
After code review, a maintainer runs the trusted real-shell verification and
binds the owner receipts.

Do not edit `.rig-proof.json`, `.render-proof.json`, or `preview.png`.
Those are maintainer-owned evidence, not contributor deliverables.

## Maintainers wanted

We are looking for dependable Omarchy users who want to review issues, test
releases, and keep a plugin healthy over time. Start with a small pull request
or open an issue titled **Maintainer interest**. Tell us which plugin you use
and how you want to help. Consistent contributors can earn maintainer
responsibility.

## Commits

Use Conventional Commits such as `feat:`, `fix:`, `test:`, `docs:`, and
`ci:`.
