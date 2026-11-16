const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const root = path.join(__dirname, "..")
const read = name => fs.readFileSync(path.join(root, name), "utf8")

test("manifest, bar host, and panel use one module id and valid entrypoint", () => {
  const manifest = JSON.parse(read("manifest.json"))
  assert.equal(fs.statSync(path.join(root, manifest.entryPoints.barWidget)).isFile(), true)
  for (const file of ["BarWidget.qml", "Panel.qml"]) assert.match(read(file), new RegExp(`moduleName: "${manifest.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`))
})

test("marketplace copy uses all 500 characters for one evidenced story", () => {
  const manifest = JSON.parse(read("manifest.json"))
  assert.equal(manifest.description.length, 500)
  assert.equal(manifest.barWidget.description.length, 500)
  assert.equal(manifest.barWidget.description, manifest.description)
  for (const claim of [
    "Every five minutes", "uncommitted edits", "unpushed commits", "old stashes",
    "detached heads", "interrupted rebases, merges, cherry-picks, or bisects",
    "interrupted work urgently", "no network calls", "does not modify repositories",
    "time and size bounded", "scan is partial"
  ]) assert.match(manifest.description, new RegExp(claim))
})

test("QML launches one bounded scanner command and keeps last known rows on failure", () => {
  const qml = read("Panel.qml")
  assert.match(qml, /manageIpc:\s*false/)
  assert.match(qml, /command:\s*\[root\.scannerPath, "--max-depth", "4", root\.scanRoot\]/)
  assert.match(qml, /readonly property int refreshSec:\s*300/)
  assert.match(qml, /var scan = Model\.readScan\(text\)/)
  assert.match(qml, /if \(scan\.valid\) \{ root\.rows = scan\.rows;/)
  // The scanner output is parsed once per scan, through the bounded reader.
  assert.doesNotMatch(qml, /Model\.(parseScan|scanInfo|isScanEnvelope)\(/)
  assert.match(qml, /else \{ root\.scanFailed = true; root\.loaded = true \}/)
})

test("banner names and illustrates the local oldest-first Git queue", () => {
  const banner = read("assets/banner.svg")
  assert.match(banner, /<title id="title">Loose Ends<\/title>/)
  assert.match(banner, /LOCAL GIT QUEUE/)
  assert.match(banner, /OLDEST FIRST/)
  assert.match(banner, /<(?:path|circle)\b/)
})

test("render tooling requires an exact real-shell receipt and human approval", () => {
  const render = read("scripts/rig-render.sh")
  assert.match(render, /OMARCHY_RIG_RESOLUTION:-1280x720/)
  assert.match(render, /rawShellLogSha256/)
  assert.match(render, /visualInspection:\{status:"pending"/)
  assert.doesNotMatch(render, /bin preview\.png/,
    "a failed capture must not poison the next source-clean retry")
  assert.match(render, /-path '\.\/e2e\/\*'/)
  assert.match(render, /rig-before-shell\.sh/)
  assert.match(render, /grim "\\\$SHOT"/)
  assert.doesNotMatch(render, /grim -g|pkill/)
  // Receipts say which Omarchy and Qt they ran on, and the render can pick a theme.
  assert.match(render, /OMARCHY_RIG_THEME:-tokyo-night/)
  assert.match(render, /OMARCHY_RIG_THEME must be a plain theme name/)
  assert.match(render, /rigVersions:\{omarchy:\$omarchy,qt:\$qt,quickshell:\$quickshell\}/)
  assert.match(read("scripts/rig-verify.sh"), /rigVersions:\{omarchy:\$omarchy, qt:\$qt\}/)
  const approval = read("scripts/approve-preview.sh")
  assert.match(approval, /product value is visible without reading the README/)
  assert.match(approval, /plugin-specific visual identity/)
})

test("deterministic render fixture exercises every Loose Ends signal", () => {
  assert.match(read("Panel.qml"), /fittedContentWidth\(Style\.space\(640\)\)/,
    "marketplace capture must keep the queue legible at card scale")
  const hook = read("e2e/rig-before-shell.sh")
  for (const signal of ["MERGE_HEAD", "12 days ago", "16 days ago", "9 days ago", "--detach"]) {
    assert.match(hook, new RegExp(signal))
  }
  for (const field of ["interrupted", "dirty", "ahead", "staleStash", "detached"]) {
    assert.match(hook, new RegExp(field))
  }
  assert.match(hook, /\.repos \| length == 5/)
  assert.doesNotMatch(hook, /https?:|curl|wget/)
  assert.equal(fs.statSync(path.join(root, "e2e/rig-before-shell.sh")).mode & 0o111, 0o111)
})

test("test workflow keeps all triggers under the on mapping", () => {
  const workflow = read(".github/workflows/test.yml")
  assert.match(workflow, /^on:\n  workflow_dispatch:\n  push:\n  pull_request:\n/m)
  assert.doesNotMatch(workflow, /^pull_request:/m)
})

test("QML qualifies Omarchy's palette as Commons.Color, never bare Color", () => {
  // Qt 6.12 introduces its own Color type; omarchy docs/omarchy-shell.md
  // (Theme tokens) requires plugins to import qs.Commons with an alias.
  const files = fs.readdirSync(root).filter(name => name.endsWith(".qml"))
  assert.ok(files.length > 0)
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), "utf8")
    assert.doesNotMatch(source, /(^|[^\w.])Color\./m, file + " uses bare Color")
    if (/Commons\.Color\./.test(source)) assert.match(source, /^import qs\.Commons as Commons$/m, file)
  }
})

test("severity colors adapt to the popup surface instead of a fixed lightness", () => {
  const qml = read("Panel.qml")
  assert.match(qml, /readonly property real surfaceLightness: Commons\.Color\.popups\.background\.hslLightness/)
  assert.match(qml, /severityColor: Qt\.hsla\(severityHue, 0\.56, Model\.toneLightness\(0\.64, 0\.26, root\.surfaceLightness\), 1\)/)
  assert.match(qml, /stripeColor: Qt\.hsla\(severityHue, 0\.56, Model\.toneLightness\(0\.64, 0\.36, root\.surfaceLightness\), 1\)/)
  // 0.64 on a light popup was 1.5 to 2.8:1.
  assert.doesNotMatch(qml, /Qt\.hsla\(severityHue, 0\.56, 0\.64, 1\)/)
})
