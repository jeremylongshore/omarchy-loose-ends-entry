const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const Model = require("../Model.js")

const root = path.join(__dirname, "..")

test("every Model function called by QML exists", () => {
  const qml = fs.readFileSync(path.join(root, "Panel.qml"), "utf8")
  const calls = [...qml.matchAll(/Model\.([A-Za-z][A-Za-z0-9_]*)\(/g)].map(match => match[1])
  assert.ok(calls.length > 0)
  for (const name of new Set(calls)) assert.equal(typeof Model[name], "function", name)
})

test("stock scanner returns a valid empty envelope with no roots", () => {
  const result = spawnSync(path.join(root, "bin", "loose-ends-scan"), [], { encoding: "utf8", timeout: 2000 })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout).repos, [])
})

test("runtime remains fixed-argv and local-only", () => {
  const qml = fs.readFileSync(path.join(root, "Panel.qml"), "utf8")
  const scanner = fs.readFileSync(path.join(root, "bin", "loose-ends-scan"), "utf8")
  assert.doesNotMatch(qml, /curl|wget|execDetached|sh -c/)
  assert.match(scanner, /GIT_OPTIONAL_LOCKS=0/)
  assert.match(scanner, /core\.hooksPath=\/dev\/null/)
  assert.match(scanner, /timeout 5 git --no-optional-locks/)
})
