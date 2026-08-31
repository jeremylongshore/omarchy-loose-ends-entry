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

test("clean, age, and summary boundaries preserve exact marketplace semantics", () => {
  assert.equal(Model.clean("abc", 2), "ab")
  assert.equal(Model.clean("ab", 2), "ab")
  assert.equal(Model.WARN_AGE, 3 * 86400)
  assert.equal(Model.STALE_AGE, 14 * 86400)
  assert.equal(Model.ageOf({ dirtyAge: 9, aheadAge: 4, stashAge: 2 }), 9)
  assert.equal(Model.ageOf({ dirtyAge: 2, aheadAge: 9, stashAge: 4 }), 9)
  assert.equal(Model.ageOf({ dirtyAge: 2, aheadAge: 4, stashAge: 9 }), 9)
  assert.equal(Model.summarize({}), "")
  assert.equal(Model.summarize({ interrupted: "cherry-pick" }), "cherry-pick in progress")
  assert.equal(Model.summarize({ detached: true }), "detached head")
  assert.equal(Model.summarize({ dirty: 1 }), "1 uncommitted")
  assert.equal(Model.summarize({ dirty: 3 }), "3 uncommitted")
  assert.equal(Model.summarize({ ahead: 1 }), "1 unpushed")
  assert.equal(Model.summarize({ ahead: 4 }), "4 unpushed")
  assert.equal(Model.summarize({ staleStash: 1 }), "1 old stash")
  assert.equal(Model.summarize({ staleStash: 5 }), "5 old stashes")
  assert.equal(Model.summarize({ interrupted: "merge", detached: true, dirty: 2, ahead: 3, staleStash: 4 }), "merge in progress, detached head, 2 uncommitted, 3 unpushed, 4 old stashes")
})

test("human age and severity thresholds are exact at every boundary", () => {
  assert.equal(Model.humanAge(3599), "just now")
  assert.equal(Model.humanAge(3600), "1 hour")
  assert.equal(Model.humanAge(7200), "2 hours")
  assert.equal(Model.humanAge(86399), "23 hours")
  assert.equal(Model.humanAge(86400), "1 day")
  assert.equal(Model.humanAge(13 * 86400), "13 days")
  assert.equal(Model.humanAge(14 * 86400), "2 weeks")
  assert.equal(Model.humanAge(59 * 86400), "8 weeks")
  assert.equal(Model.humanAge(60 * 86400), "2 months")
  assert.equal(Model.severity({ dirtyAge: Model.WARN_AGE - 1 }), "fresh")
  assert.equal(Model.severity({ dirtyAge: Model.WARN_AGE }), "warn")
  assert.equal(Model.severity({ dirtyAge: Model.STALE_AGE - 1 }), "warn")
  assert.equal(Model.severity({ dirtyAge: Model.STALE_AGE }), "stale")
  assert.equal(Model.severity({ interrupted: "rebase", dirtyAge: 0 }), "urgent")
})

test("scan envelope metadata distinguishes invalid, complete, and partial inputs", () => {
  const invalid = { valid: false, repoTotal: 0, truncated: false }
  assert.deepEqual(Model.scanInfo("null"), invalid)
  assert.deepEqual(Model.scanInfo("{}"), invalid)
  assert.deepEqual(Model.scanInfo('{"repos":{}}'), invalid)
  assert.deepEqual(Model.scanInfo('{"repos":[],"repoTotal":-4}'), { valid: true, repoTotal: 0, truncated: false })
  assert.deepEqual(Model.scanInfo('{"repos":[],"repoTotal":"bad"}'), { valid: true, repoTotal: 0, truncated: false })
  assert.deepEqual(Model.scanInfo(JSON.stringify({ repos: Array(Model.MAX_ROWS).fill({}), repoTotal: Model.MAX_ROWS })), { valid: true, repoTotal: Model.MAX_ROWS, truncated: false })
  assert.deepEqual(Model.scanInfo(JSON.stringify({ repos: Array(Model.MAX_ROWS + 1).fill({}), repoTotal: Model.MAX_ROWS + 1 })), { valid: true, repoTotal: Model.MAX_ROWS + 1, truncated: true })
  assert.deepEqual(Model.scanInfo('{"repos":[],"truncated":true}'), { valid: true, repoTotal: 0, truncated: true })
})

test("parseScan normalizes every field, caps rows, and does not mutate callers", () => {
  const raw = JSON.stringify({ repos: [{
    path: "/repo", name: "repo", branch: "main", detached: 1,
    dirty: "2", dirtyAge: "3", ahead: "4", aheadAge: "5",
    staleStash: "6", stashAge: "7", interrupted: "merge"
  }] })
  const row = Model.parseScan(raw)[0]
  assert.deepEqual(row, {
    path: "/repo", name: "repo", branch: "main", detached: true,
    dirty: 2, dirtyAge: 3, ahead: 4, aheadAge: 5, staleStash: 6,
    stashAge: 7, interrupted: "merge", age: 7,
    summary: "merge in progress, detached head, 2 uncommitted, 4 unpushed, 6 old stashes",
    severity: "urgent", ageText: "just now"
  })
  assert.deepEqual(Model.parseScan("null"), [])
  assert.deepEqual(Model.parseScan('{"repos":[]}'), [])
  const source = [{ name: "z", age: 1 }, { name: "a", age: 2 }]
  const sorted = Model.sortRows(source)
  assert.deepEqual(source.map(item => item.name), ["z", "a"])
  assert.deepEqual(sorted.map(item => item.name), ["a", "z"])
})

test("sorting and pill severity honor rank, age, and stable name tie-breaks", () => {
  const rows = [
    { name: "z", age: 10, severity: "fresh" },
    { name: "a", age: 10, severity: "warn" },
    { name: "detached", age: 1, detached: true, severity: "stale" },
    { name: "merge", age: 0, interrupted: "merge", severity: "urgent" }
  ]
  assert.deepEqual(Model.sortRows(rows).map(row => row.name), ["merge", "detached", "a", "z"])
  assert.equal(Model.pillSeverity([{ severity: "fresh" }, { severity: "warn" }, { severity: "stale" }, { severity: "urgent" }]), "urgent")
  assert.equal(Model.pillSeverity([{ severity: "warn" }, { severity: "warn" }]), "warn")
})
