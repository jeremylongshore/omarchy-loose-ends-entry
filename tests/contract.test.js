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
  assert.match(qml, /if \(info\.valid\) \{ root\.rows = parsed;/)
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
