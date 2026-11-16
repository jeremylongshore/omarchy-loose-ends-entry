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
// and a repository directory is a user-controlled name. Strip angle brackets;
// ASCII controls; bidi override and isolate marks (U+202A to U+202E, U+2066 to
// U+2069, U+200E, U+200F, U+061C), which can reorder a name so one repository
// reads as another (CVE-2021-42574 class); and Unicode tag characters (U+E0000
// to U+E007F), which are invisible. Tag characters are the surrogate pair
// U+DB40 then U+DC00 to U+DC7F in a JS string, so the pattern needs no `u` flag
// and stays ES5. Then cap the length, after stripping, so a pathological path
// cannot become a layout cost and stripped marks never eat the budget.
function clean(value, max) {
  var s = String(value === undefined || value === null ? "" : value)
  s = s.replace(/[<>]/g, "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\udb40[\udc00-\udc7f]/g, "")
  var cap = max || 64
  return s.length > cap ? s.slice(0, cap) : s
}

// Panels pick text and edge lightness for the surface they sit on. Light on a
// light popup was 1.5 to 2.8:1 on catppuccin-latte, white and flexoki-light.
// Exactly 0.5 counts as dark, and a missing reading stays dark.
function toneLightness(dark, light, surfaceLightness) {
  return Number(surfaceLightness) > 0.5 ? light : dark
}

var DAY = 86400
var HOUR = 3600

// Severity is driven by AGE, not by count. Eleven repositories touched today are
// work in progress. One repository untouched for two weeks is the thing you
// forgot, and it is the only one worth interrupting anyone about.
var WARN_AGE = 3 * DAY
var STALE_AGE = 14 * DAY
var MAX_ROWS = 256

// The scanner prints at most 256 repositories, and its worst escaped row (a
// 1024-byte path, 255-byte name and 200-byte branch, every byte escaped to two)
// is about 3.3 KB, so 1 MiB is above anything it can print. Anything longer is
// refused before JSON.parse sees it.
var MAX_SCAN_CHARS = 1048576

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

function severityHue(level) {
  if (level === "urgent") return 0.00
  if (level === "stale") return 0.055
  if (level === "warn") return 0.12
  return 0.48
}

// Parse the scanner's output into display rows. Malformed input returns the empty
// shape so the panel keeps last-good state rather than tearing itself down. A
// scanner that fails should read as "nothing new", never as "everything is fine".
//
// readEnvelope is the one place scanner output is parsed. Oversized text, text
// that is not JSON and JSON without a repos array all read as "no envelope".
function readEnvelope(raw) {
  var text = String(raw || "")
  if (text.length > MAX_SCAN_CHARS) return null
  var data
  try { data = JSON.parse(text) } catch (e) { return null }
  if (!data || Object.prototype.toString.call(data.repos) !== "[object Array]") return null
  return data
}

function isScanEnvelope(raw) {
  return readEnvelope(raw) !== null
}

function envelopeInfo(data) {
  if (!data) return { valid: false, repoTotal: 0, truncated: false }
  return { valid: true, repoTotal: Math.max(0, Number(data.repoTotal) || 0), truncated: !!data.truncated || data.repos.length > MAX_ROWS }
}

function scanInfo(raw) {
  return envelopeInfo(readEnvelope(raw))
}

function parseScan(raw) {
  var data = readEnvelope(raw)
  return data ? rowsOf(data) : []
}

// One parse for the panel: validity, totals, truncation and rows together.
function readScan(raw) {
  var data = readEnvelope(raw)
  var info = envelopeInfo(data)
  info.rows = data ? rowsOf(data) : []
  return info
}

function rowsOf(data) {
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
  severityHue: severityHue,
  isScanEnvelope: isScanEnvelope,
  scanInfo: scanInfo,
  readScan: readScan,
  parseScan: parseScan,
  sortRows: sortRows,
  pillText: pillText,
  pillSeverity: pillSeverity,
  tooltipText: tooltipText,
  toneLightness: toneLightness,
  WARN_AGE: WARN_AGE,
  STALE_AGE: STALE_AGE,
  MAX_ROWS: MAX_ROWS,
  MAX_SCAN_CHARS: MAX_SCAN_CHARS
}

if (typeof module !== "undefined" && module.exports) module.exports = Model
