const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const sourceSync = path.join(__dirname, "..", "scripts", "sync-gate-lane.sh")
const applicable = ["c28", "c29", "c30", "c31", "c34", "c35", "c36", "c38", "c40", "c41", "c42", "c43"]

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" })
  assert.equal(result.status, 0, result.stdout + result.stderr)
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omarchy-gate-sync-"))
  const canonical = path.join(root, "canonical")
  const gates = path.join(canonical, "skills", "contribute", "scripts", "gates")
  const scripts = path.join(root, "template", "scripts")
  fs.mkdirSync(path.join(gates, "lib"), { recursive: true })
  fs.mkdirSync(scripts, { recursive: true })
  for (const id of applicable) {
    fs.writeFileSync(path.join(gates, `${id}-fixture.sh`), `#!/usr/bin/env bash\n# ${id}\n`)
  }
  fs.writeFileSync(path.join(gates, "lib", "preamble.sh"), "#!/usr/bin/env bash\n")
  fs.copyFileSync(sourceSync, path.join(scripts, "sync-gate-lane.sh"))
  git(canonical, ["init", "-q"])
  git(canonical, ["add", "."])
  git(canonical, ["-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "-qm", "fixture"])
  return { root, canonical, gates, scripts }
}

test("sync records an exact clean canonical commit and complete denominator", () => {
  const f = fixture()
  try {
    const result = spawnSync("bash", [path.join(f.scripts, "sync-gate-lane.sh"), f.gates], { encoding: "utf8" })
    assert.equal(result.status, 0, result.stdout + result.stderr)
    const manifest = fs.readFileSync(path.join(f.scripts, "gates", ".lane-manifest"), "utf8")
    const commit = spawnSync("git", ["-C", f.canonical, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim()
    assert.match(manifest, new RegExp(`canonical: contributing-clanker@${commit}`))
    assert.equal(manifest.split("\n").filter((line) => /^[a-f0-9]{64}  /.test(line)).length, 13)
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true })
  }
})

test("sync refuses dirty or untracked canonical gate source", () => {
  const f = fixture()
  try {
    fs.appendFileSync(path.join(f.gates, "c28-fixture.sh"), "# dirty\n")
    fs.writeFileSync(path.join(f.gates, "untracked.sh"), "# untracked\n")
    const result = spawnSync("bash", [path.join(f.scripts, "sync-gate-lane.sh"), f.gates], { encoding: "utf8" })
    assert.equal(result.status, 2, result.stdout + result.stderr)
    assert.match(result.stderr, /REFUSING dirty canonical gate source/)
    assert.equal(fs.existsSync(path.join(f.scripts, "gates", ".lane-manifest")), false)
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true })
  }
})
