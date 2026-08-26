const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { execFileSync } = require("node:child_process")

const scanner = path.join(__dirname, "..", "bin", "loose-ends-scan")

function run(...args) {
  return JSON.parse(execFileSync(scanner, args, { encoding: "utf8" }))
}

function git(...args) {
  execFileSync("git", args, { stdio: "ignore" })
}

test("scanner returns an empty, valid envelope with no roots", () => {
  const result = run()
  assert.equal(Number.isInteger(result.generatedAt), true)
  assert.equal(result.repoTotal, 0)
  assert.equal(result.truncated, false)
  assert.deepEqual(result.repos, [])
})

test("scanner reports only unfinished repositories and safely serializes unusual paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "loose-ends-test-"))
  try {
    const clean = path.join(root, "clean")
    const dirty = path.join(root, "needs <attention>")
    for (const repo of [clean, dirty]) {
      git("init", "-q", repo)
      git("-C", repo, "config", "user.email", "test@example.invalid")
      git("-C", repo, "config", "user.name", "Test")
      fs.writeFileSync(path.join(repo, "tracked.txt"), "base\n")
      git("-C", repo, "add", "tracked.txt")
      git("-C", repo, "commit", "-qm", "initial")
    }
    fs.writeFileSync(path.join(dirty, "tracked.txt"), "changed\n")

    const result = run("--jobs", "2", root)
    assert.equal(result.repos.length, 1)
    assert.equal(result.repoTotal, 2)
    assert.equal(result.truncated, false)
    assert.equal(result.repos[0].name, "needs <attention>")
    assert.equal(result.repos[0].dirty, 1)
    assert.equal(result.repos[0].detached, false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
