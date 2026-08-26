// Loose Ends data layer.
//
// Pure ES5. Loads identically in Quickshell (import "Model.js" as Model) and in
// node for the offline suite, so the entire display path is testable without a
// compositor running. Nothing here touches the filesystem, spawns a process, or
// opens a socket: bin/loose-ends-scan does all of that and hands this file a
// string.
//
// There is no network in this plugin at all, so there is no host policy, no
// allowlist, and no URL to validate. That is a deliberate design choice, not an
// omission.

// Every string that reaches a QML Text goes through this first. A bar label
// renders as Qt AutoText, which promotes an HTML-looking string to StyledText,
// and a repository directory is a user-controlled name. Strip angle brackets and
// control characters, and cap the length so a pathological path cannot become a
// layout cost.
function clean(value, max) {
  var s = String(value === undefined || value === null ? "" : value)
  s = s.replace(/[<>]/g, "").replace(/[\x00-\x1f\x7f]/g, "")
  var cap = max || 64
  return s.length > cap ? s.slice(0, cap) : s
}

var DAY = 86400
var HOUR = 3600

// Severity is driven by AGE, not by count. Eleven repositories touched today are
// work in progress. One repository untouched for two weeks is the thing you
// forgot, and it is the only one worth interrupting anyone about.
var WARN_AGE = 3 * DAY
var STALE_AGE = 14 * DAY
var MAX_ROWS = 256

// An interrupted operation outranks everything by age, because the repository is
// in a state nobody meant to leave it in and git will keep saying so until it is
// resolved.
var KIND_RANK = { "rebase": 4, "merge": 4, "cherry-pick": 4, "bisect": 4, "detached": 3 }

function ageOf(r) {
  if (!r) return 0
  var a = 0
  if (r.dirtyAge > a) a = r.dirtyAge
  if (r.aheadAge > a) a = r.aheadAge
  if (r.stashAge > a) a = r.stashAge
  return a
}

// What is actually wrong here, most alarming first. Returns a short phrase, never
// a sentence, because it renders in a fixed-width row.
function summarize(r) {
  if (!r) return ""
  var parts = []
  if (r.interrupted) parts.push(clean(r.interrupted, 12) + " in progress")
  if (r.detached) parts.push("detached head")
  if (r.dirty > 0) parts.push(r.dirty === 1 ? "1 uncommitted" : r.dirty + " uncommitted")
  if (r.ahead > 0) parts.push(r.ahead === 1 ? "1 unpushed" : r.ahead + " unpushed")
  if (r.staleStash > 0) parts.push(r.staleStash === 1 ? "1 old stash" : r.staleStash + " old stashes")
  return parts.join(", ")
}

// Human age. Deliberately coarse: the difference between 41 and 43 minutes does
// not change anyone's decision, and a precise number invites staring at it.
function humanAge(seconds) {
  var s = Number(seconds) || 0
  if (s < HOUR) return "just now"
  if (s < DAY) {
    var h = Math.floor(s / HOUR)
    return h + (h === 1 ? " hour" : " hours")
  }
  var d = Math.floor(s / DAY)
  if (d < 14) return d + (d === 1 ? " day" : " days")
  if (d < 60) return Math.floor(d / 7) + " weeks"
  return Math.floor(d / 30) + " months"
}

function severity(r) {
  var a = ageOf(r)
  if (r && r.interrupted) return "urgent"
  if (a >= STALE_AGE) return "stale"
  if (a >= WARN_AGE) return "warn"
  return "fresh"
}

// Parse the scanner's output into display rows. Malformed input returns the empty
// shape so the panel keeps last-good state rather than tearing itself down. A
// scanner that fails should read as "nothing new", never as "everything is fine".
function isScanEnvelope(raw) {
  var data
  try { data = JSON.parse(String(raw || "")) } catch (e) { return false }
  return !!(data && Object.prototype.toString.call(data.repos) === "[object Array]")
}

function scanInfo(raw) {
  var data
  try { data = JSON.parse(String(raw || "")) } catch (e) { return { valid: false, repoTotal: 0, truncated: false } }
  if (!data || Object.prototype.toString.call(data.repos) !== "[object Array]") return { valid: false, repoTotal: 0, truncated: false }
  return { valid: true, repoTotal: Math.max(0, Number(data.repoTotal) || 0), truncated: !!data.truncated || data.repos.length > MAX_ROWS }
}

function parseScan(raw) {
  var data
  try { data = JSON.parse(String(raw || "")) } catch (e) { return [] }
  if (!data || Object.prototype.toString.call(data.repos) !== "[object Array]" || !data.repos.length) return []
  var out = []
  for (var i = 0; i < data.repos.length && i < MAX_ROWS; i++) {
    var r = data.repos[i]
    if (!r || !r.path) continue
    var row = {
      path: clean(r.path, 200),
      name: clean(r.name, 40),
      branch: clean(r.branch, 40),
      detached: !!r.detached,
      dirty: Number(r.dirty) || 0,
      dirtyAge: Number(r.dirtyAge) || 0,
      ahead: Number(r.ahead) || 0,
      aheadAge: Number(r.aheadAge) || 0,
      staleStash: Number(r.staleStash) || 0,
      stashAge: Number(r.stashAge) || 0,
      interrupted: clean(r.interrupted, 12)
    }
    row.age = ageOf(row)
    row.summary = summarize(row)
    row.severity = severity(row)
    row.ageText = humanAge(row.age)
    out.push(row)
  }
  return sortRows(out)
}

// Oldest first, with interrupted operations pulled to the top regardless of age.
// A repository dirty for an hour is work in progress; one dirty for eleven days
// is the loose end this plugin is named after.
function sortRows(rows) {
  return rows.slice().sort(function (a, b) {
    var ra = KIND_RANK[a.interrupted] || (a.detached ? KIND_RANK.detached : 0)
    var rb = KIND_RANK[b.interrupted] || (b.detached ? KIND_RANK.detached : 0)
    if (ra !== rb) return rb - ra
    if (b.age !== a.age) return b.age - a.age
    return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0)
  })
}

// The pill. Empty string means the slot collapses and the widget disappears,
// which is the correct state when there is nothing to say.
function pillText(rows) {
  if (!rows || !rows.length) return ""
  var worst = rows[0]
  if (worst.interrupted) return clean(worst.interrupted, 12)
  return String(rows.length)
}

// Pill severity drives colour. It is the worst row's severity, not an average:
// one two-week-old repository should not be diluted by nine fresh ones.
function pillSeverity(rows) {
  if (!rows || !rows.length) return "fresh"
  var order = { "fresh": 0, "warn": 1, "stale": 2, "urgent": 3 }
  var worst = "fresh"
  for (var i = 0; i < rows.length; i++) {
    if (order[rows[i].severity] > order[worst]) worst = rows[i].severity
  }
  return worst
}

function tooltipText(rows) {
  if (!rows || !rows.length) return "No loose ends"
  var n = rows.length
  var head = n === 1 ? "1 repository needs you" : n + " repositories need you"
  return head + ", oldest " + rows[0].ageText
}

var Model = {
  clean: clean,
  ageOf: ageOf,
  summarize: summarize,
  humanAge: humanAge,
  severity: severity,
  isScanEnvelope: isScanEnvelope,
  scanInfo: scanInfo,
  parseScan: parseScan,
  sortRows: sortRows,
  pillText: pillText,
  pillSeverity: pillSeverity,
  tooltipText: tooltipText,
  WARN_AGE: WARN_AGE,
  STALE_AGE: STALE_AGE
  , MAX_ROWS: MAX_ROWS
}

if (typeof module !== "undefined" && module.exports) module.exports = Model
