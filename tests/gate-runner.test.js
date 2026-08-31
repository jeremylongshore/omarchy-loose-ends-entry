const test = require("node:test")
const assert = require("node:assert/strict")
const crypto = require("node:crypto")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const sourceRunner = path.join(__dirname, "..", "scripts", "run-plugin-gates.sh")

function runWithGate(stdout, exitCode = 0) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omarchy-gate-runner-"))
  try {
    const scripts = path.join(root, "scripts")
    const gates = path.join(scripts, "gates")
    const target = path.join(root, "plugin")
    fs.mkdirSync(gates, { recursive: true })
    fs.mkdirSync(target)
    fs.copyFileSync(sourceRunner, path.join(scripts, "run-plugin-gates.sh"))

    const gateName = "c99-fixture.sh"
    const gateBody = [
      "#!/usr/bin/env bash",
      `printf '%s' ${JSON.stringify(stdout)}`,
      `exit ${exitCode}`,
      ""
    ].join("\n")
    const gatePath = path.join(gates, gateName)
    fs.writeFileSync(gatePath, gateBody)
    const hash = crypto.createHash("sha256").update(gateBody).digest("hex")
    fs.writeFileSync(
      path.join(gates, ".lane-manifest"),
      `# test lane\n${hash}  ${gateName}\n`
    )

    return spawnSync("bash", [path.join(scripts, "run-plugin-gates.sh"), target], {
      encoding: "utf8"
    })
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

test("accepts exactly one valid PASS verdict", () => {
  const result = runWithGate('{"severity":"PASS","gate":"C99","reason":"clean"}')
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /plugin gates: PASS \(1 enforced/)
})

test("blocks a valid BLOCK verdict", () => {
  const result = runWithGate('{"severity":"BLOCK","gate":"C99","reason":"unsafe","fix_hint":"fix it"}')
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stdout, /plugin gates: BLOCKED/)
})

for (const [name, output] of [
  ["malformed JSON", "not-json"],
  ["multiple JSON values", '{"severity":"PASS","gate":"C99","reason":"first"}\n{"severity":"BLOCK","gate":"C99","reason":"second"}'],
  ["a JSON array", '[{"severity":"PASS","gate":"C99","reason":"nested"}]'],
  ["an unknown severity", '{"severity":"MAYBE","gate":"C99","reason":"unknown"}'],
  ["a missing gate id", '{"severity":"PASS","reason":"anonymous"}']
]) {
  test(`fails closed on ${name}`, () => {
    const result = runWithGate(output)
    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.match(result.stdout, /CRASH\s+invalid verdict/)
    assert.match(result.stdout, /plugin gates: BLOCKED/)
  })
}

test("fails closed when a gate exits non-zero after printing PASS", () => {
  const result = runWithGate('{"severity":"PASS","gate":"C99","reason":"misleading"}', 7)
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stdout, /CRASH\s+gate exited 7/)
  assert.match(result.stdout, /plugin gates: BLOCKED/)
})
