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
  assert.deepEqual(Model.parseScan("not json"), [])
  assert.deepEqual(Model.parseScan(""), [])
  assert.deepEqual(Model.parseScan('{"repos": {}}'), [])
  assert.deepEqual(Model.parseScan('{"repos": [{"name": "no path"}]}'), [])
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
