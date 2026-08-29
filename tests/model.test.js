const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const Model = require("../Model.js")

const fixture = (name) =>
  fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8")

test("clean strips AutoText markers and control characters", () => {
  assert.equal(Model.clean('<img src="http://x/y.png">Bo'), 'img src="http://x/y.png"Bo')
  assert.equal(Model.clean("a\x00b\x1fc\x7fd"), "abcd")
  assert.equal(Model.clean("x".repeat(500), 64).length, 64)
  assert.equal(Model.clean(null), "")
})

test("parseScan rejects malformed and wrong-shaped scanner output", () => {
  assert.equal(Model.isScanEnvelope('{"repos": []}'), true)
  assert.equal(Model.isScanEnvelope('{"repos": {}}'), false)
  assert.equal(Model.isScanEnvelope('{"broken": true}'), false)
  assert.equal(Model.isScanEnvelope("not json"), false)
  assert.deepEqual(Model.scanInfo("not json"), { valid: false, repoTotal: 0, truncated: false })
  assert.deepEqual(Model.scanInfo('{"repoTotal": 300, "truncated": true, "repos": []}'), { valid: true, repoTotal: 300, truncated: true })
  assert.deepEqual(Model.parseScan("not json"), [])
  assert.deepEqual(Model.parseScan(""), [])
  assert.deepEqual(Model.parseScan('{"repos": {}}'), [])
  assert.deepEqual(Model.parseScan('{"repos": [{"name": "no path"}]}'), [])
})

test("parser caps hostile scanner rows and says that the result is partial", () => {
  const repos = []
  for (let i = 0; i < Model.MAX_ROWS + 1; i++) repos.push({ path: "/" + i, name: String(i), dirty: 1 })
  const raw = JSON.stringify({ repoTotal: repos.length, truncated: false, repos })
  assert.equal(Model.parseScan(raw).length, Model.MAX_ROWS)
  assert.deepEqual(Model.scanInfo(raw), { valid: true, repoTotal: repos.length, truncated: true })
})

test("parseScan sanitizes, derives display fields, and orders oldest first", () => {
  const rows = Model.parseScan(fixture("scan-real.json"))
  assert.ok(rows.length > 5)
  assert.equal(rows[0].name, "rssatoms")
  assert.equal(rows[0].severity, "stale")
  assert.match(rows[0].summary, /unpushed/)
  assert.equal(rows.at(-1).name, "bobs-brain-ref")
  assert.equal(rows.at(-1).severity, "fresh")

  const hostile = Model.parseScan(JSON.stringify({ repos: [{
    path: "/tmp/<img>", name: "<b>repo</b>", branch: "\x00main",
    dirty: 1, dirtyAge: Model.WARN_AGE
  }] }))
  assert.equal(hostile[0].name, "brepo/b")
  assert.equal(hostile[0].branch, "main")
  assert.equal(hostile[0].severity, "warn")
})

test("interrupted work outranks age and drives the urgent pill", () => {
  const rows = Model.parseScan(JSON.stringify({ repos: [
    { path: "/old", name: "old", dirty: 1, dirtyAge: 90 * 86400 },
    { path: "/merge", name: "merge", interrupted: "merge", dirty: 1, dirtyAge: 10 }
  ] }))
  assert.equal(rows[0].name, "merge")
  assert.equal(rows[0].severity, "urgent")
  assert.equal(Model.pillText(rows), "merge")
  assert.equal(Model.pillSeverity(rows), "urgent")
  assert.equal(Model.severityHue("urgent"), 0)
  assert.equal(Model.severityHue("stale"), 0.055)
  assert.equal(Model.severityHue("warn"), 0.12)
  assert.equal(Model.severityHue("fresh"), 0.48)
})

test("ages stay intentionally coarse and the quiet state collapses the pill", () => {
  assert.equal(Model.humanAge(0), "just now")
  assert.equal(Model.humanAge(3600), "1 hour")
  assert.equal(Model.humanAge(3 * 86400), "3 days")
  assert.equal(Model.humanAge(20 * 86400), "2 weeks")
  assert.equal(Model.pillText([]), "")
  assert.equal(Model.pillSeverity([]), "fresh")
  assert.equal(Model.tooltipText([]), "No loose ends")
})

test("ordinary rows produce a count pill and singular tooltip", () => {
  const one = Model.parseScan(JSON.stringify({ repos: [
    { path: "/one", name: "one", dirty: 1, dirtyAge: 10 }
  ] }))
  const two = one.concat(one)
  assert.equal(Model.pillText(one), "1")
  assert.equal(Model.pillText(two), "2")
  assert.equal(Model.tooltipText(one), "1 repository needs you, oldest just now")
  assert.equal(Model.tooltipText(two), "2 repositories need you, oldest just now")
})

test("model handles empty, singular, tie-break, and each loose-end signal", () => {
  assert.equal(Model.ageOf(null), 0)
  assert.equal(Model.summarize(null), "")
  assert.equal(Model.severity(null), "fresh")
  assert.equal(Model.humanAge(2 * 3600), "2 hours")
  assert.equal(Model.humanAge(14 * 86400), "2 weeks")
  assert.equal(Model.humanAge(61 * 86400), "2 months")
  assert.equal(Model.pillText(null), "")
  assert.equal(Model.pillSeverity(null), "fresh")
  assert.equal(Model.tooltipText(null), "No loose ends")

  const rows = Model.parseScan(JSON.stringify({ repos: [
    null,
    { name: "missing-path" },
    { path: "/signals", name: "signals", detached: true, dirty: 1, dirtyAge: 2, ahead: 1, aheadAge: 3, staleStash: 1, stashAge: 4 },
    { path: "/z", name: "z", dirty: 1, dirtyAge: 9 },
    { path: "/a", name: "a", dirty: 1, dirtyAge: 9 }
  ] }))
  assert.equal(rows.length, 3)
  assert.equal(rows[0].name, "signals")
  assert.equal(rows[1].name, "a")
  assert.match(rows[0].summary, /detached head, 1 uncommitted, 1 unpushed, 1 old stash/)
})
