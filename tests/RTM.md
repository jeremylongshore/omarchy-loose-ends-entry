# Requirements Traceability Matrix: Loose Ends

| Req ID | Priority | Requirement | Evidence | Status |
|---|---|---|---|---|
| REQ-LE-001 | MUST | Detect the five documented unfinished Git signals | scanner/model tests | Covered |
| REQ-LE-002 | MUST | Put interrupted and oldest work first | model tests | Covered |
| REQ-LE-003 | MUST | Make no network calls or intentional repository writes | smoke/static gates | Covered |
| REQ-LE-004 | MUST | Bound roots, depth, repository count, jobs, time, and output | scanner tests/C42 | Covered |
| REQ-LE-005 | MUST | Preserve last known rows and disclose failed or partial scans | contract/model tests | Covered |
| REQ-LE-006 | MUST | Expose a named bar control and keyboard panel routing | a11y tests | Covered |
| REQ-LE-007 | MUST | Use truthful identical 500-character marketplace copy and a unique banner | contract/C43 | Covered |
| REQ-LE-008 | MUST | Validate and render the exact source revision on Buzz | e2e/buzz.sh, .rig-proof.json, .render-proof.json (C37, C43) | Covered |
| REQ-LE-009 | MUST | Approve the same 16:9 preview hash at marketplace scale | approve-preview.sh/C43 | Covered (agent inspection; human sign-off outstanding) |
| REQ-LE-010 | MUST | Strip angle brackets, controls, bidi marks and tag characters from every repository string, and refuse scanner output over 1 MiB before parsing | model tests | Covered |
| REQ-LE-011 | SHOULD | Keep severity text and stripes legible on light themes by choosing lightness from the popup surface | model/contract tests, rig render on a light theme | Covered |
