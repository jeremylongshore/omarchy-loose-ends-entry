# Changelog

Notable changes to this plugin.

Entries are derived from this repository's commit history, so every line
corresponds to a real change. The format follows Keep a Changelog and the
project uses Semantic Versioning.

Add release notes by hand when this plugin ships. Keep each entry tied to a
verified commit or release change. Avoid em and en dashes because gate c28
rejects them in shipped prose.

## [Unreleased]

Nothing yet.

## [0.1.2] - 2026-11-15

### Fixed

- Strip bidirectional override and isolate marks (U+202A to U+202E, U+2066 to
  U+2069, U+200E, U+200F, U+061C) and Unicode tag characters (U+E0000 to
  U+E007F) from every repository string before it reaches the panel. A
  repository name could otherwise reorder itself to read as another, or carry
  invisible text. Length is now capped after stripping.
- Refuse scanner output above 1 MiB before parsing it, and parse each scan once
  instead of twice. The scanner prints at most 256 repositories, about 3.3 KB
  each in the worst escaped case.
- Keep severity text and stripes legible on light themes. The fixed lightness
  was 1.5 to 2.8:1 on catppuccin-latte, white and flexoki-light; it is 6:1 or
  better for text now.
- Correct the security text, which described a state lifecycle the plugin does
  not have.
- Correct the test audit, testing context and requirements matrix: test counts,
  the render and receipt status that was marked pending, and the audit-harness
  version.

### Added

- README section on what the preview image shows (a rig fixture of five
  throwaway repositories, not a real machine).
- Rig receipts record the Omarchy revision and the Qt version they ran on, and
  `OMARCHY_RIG_THEME` renders on another theme.

### Changed

- Resolve the development-tool advisories (brace-expansion, fast-uri, glob,
  minimatch, qs, zod) and refresh the vendored gate lane to canonical `f79d8c7`.
- Add a markdownlint configuration for tables, the partner badge, issue
  templates and per-release changelog headings.
- Label the MiniMax review pin as the fork's main, two commits after v0.5.0.

## [0.1.1] - 2026-11-15

### Fixed

- Qualify Omarchy's palette as `Commons.Color`, as the shell contract requires
  now that Qt 6.12 has its own `Color` type. A contract test fails on any bare
  `Color.` in the shipped QML.

### Changed

- Seed the rig render's isolated home with the current-theme state a real
  Omarchy install has, so first-party shell plugins on current Omarchy do not
  log warnings the render would read as plugin warnings.
- Bump `actions/setup-node` to 7.1.0 and the MiniMax review action to the
  fork's current main (`cfb2c72`), with the audit harness re-pinned.

## [0.1.0] - 2026-08-25

### Added

- Initial plugin.
