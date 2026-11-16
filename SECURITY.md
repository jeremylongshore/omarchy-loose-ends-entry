# Security

## Reporting a vulnerability

Use the repository **Security** tab and choose **Report a vulnerability**.
Do not open a public issue first. Expect acknowledgement within a few days.
This is a personal open source project, not a staffed service.

## Runtime boundary

Omarchy plugins run unsandboxed inside the user session and long-lived
Quickshell process. Security-sensitive changes must preserve these rules:

- No credentials in process arguments.
- No shell command assembled from untrusted data.
- Network and local inputs are bounded by count and bytes.
- Untrusted text renders as plain text within explicit bounds.
- Runtime dependencies are limited to software shipped by stock Omarchy.
- The plugin keeps no persistent state of its own. The scanner only reads Git
  plumbing, and the panel only holds the last scan in memory.
- Scanner output is refused above 1 MiB before it is parsed, capped at 256
  repositories, and every string from it is stripped of angle brackets, ASCII
  controls, bidi override and isolate marks and Unicode tag characters, then
  length capped, before it reaches a `Text`.

Passing static gates is not a security audit. Applicable releases also require
review and a clean real-shell verification on the maintainer rig.
