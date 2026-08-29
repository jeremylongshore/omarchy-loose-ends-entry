const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { execFileSync, spawn, spawnSync } = require("node:child_process")

const scanner = path.join(__dirname, "..", "bin", "loose-ends-scan")

function run(...args) {
  return JSON.parse(execFileSync(scanner, args, { encoding: "utf8" }))
}

function git(...args) {
  execFileSync("git", args, { stdio: "ignore" })
}

function makeDirtyRepo(root, name) {
  const repo = path.join(root, name)
  git("init", "-q", repo)
  git("-C", repo, "config", "user.email", "test@example.invalid")
  git("-C", repo, "config", "user.name", "Test")
  fs.writeFileSync(path.join(repo, "tracked.txt"), "base\n")
  git("-C", repo, "add", "tracked.txt")
  git("-C", repo, "commit", "-qm", "initial")
  fs.writeFileSync(path.join(repo, "tracked.txt"), "changed\n")
  return repo
}

function stopRacer(child) {
  if (child.exitCode !== null) return Promise.resolve()
  return new Promise(resolve => { child.once("close", resolve); child.kill() })
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

test("scanner emits valid JSON for a repository path containing a newline", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "loose-ends-newline-"))
  const dirty = path.join(root, "needs\na-return")
  try {
    git("init", "-q", dirty)
    git("-C", dirty, "config", "user.email", "test@example.invalid")
    git("-C", dirty, "config", "user.name", "Test")
    fs.writeFileSync(path.join(dirty, "tracked.txt"), "base\n")
    git("-C", dirty, "add", "tracked.txt")
    git("-C", dirty, "commit", "-qm", "initial")
    fs.writeFileSync(path.join(dirty, "tracked.txt"), "changed\n")

    const result = run("--jobs", "1", root)
    assert.equal(result.repos.length, 1)
    assert.equal(result.repos[0].name, "needs\na-return")
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("scanner ignores a symlinked TMPDIR and creates no named repolist", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "loose-ends-no-temp-"))
  try {
    makeDirtyRepo(root, "dirty")
    const scratch = path.join(root, "scratch"); const linked = path.join(root, "tmp-link")
    fs.mkdirSync(scratch); fs.symlinkSync(scratch, linked, "dir")
    const result = JSON.parse(execFileSync(scanner, [root], {
      encoding: "utf8", env: { ...process.env, TMPDIR: linked }
    }))
    assert.equal(result.repos.length, 1)
    assert.deepEqual(fs.readdirSync(scratch), [])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("scanner does not open a FIFO TMPDIR and returns without blocking", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "loose-ends-fifo-"))
  try {
    makeDirtyRepo(root, "dirty")
    const fifo = path.join(root, "hostile-tmpdir")
    const made = spawnSync("mkfifo", [fifo], { encoding: "utf8" }); assert.equal(made.status, 0, made.stderr)
    const output = execFileSync(scanner, [root], {
      encoding: "utf8", timeout: 3000, env: { ...process.env, TMPDIR: fifo }
    })
    assert.equal(JSON.parse(output).repos.length, 1)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test("same-UID temporary replacement racer cannot redirect writes to a victim", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "loose-ends-racer-"))
  const scratch = path.join(root, "scratch"); fs.mkdirSync(scratch)
  const victim = path.join(root, "victim"); fs.writeFileSync(victim, "precious")
  makeDirtyRepo(root, "dirty")
  const racer = spawn(process.execPath, [path.join(__dirname, "fixtures", "repolist-swap-racer.js"), scratch, victim], { stdio: "ignore" })
  try {
    for (let i = 0; i < 12; i++) {
      const output = execFileSync(scanner, [root], { encoding: "utf8", env: { ...process.env, TMPDIR: scratch } })
      assert.equal(JSON.parse(output).repos.length, 1)
    }
    assert.equal(fs.readFileSync(victim, "utf8"), "precious")
  } finally {
    await stopRacer(racer)
    fs.rmSync(root, { recursive: true, force: true })
  }
})
