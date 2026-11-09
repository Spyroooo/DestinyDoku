import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (name) => JSON.parse(readFileSync(path.join(root, 'src/data/destiny2', name), 'utf8'))
const weapons = read('weapons.json')
const releases = read('releases.json')

// Type-check JSON literals against the real application types without writing a file.
const filename = path.join(root, 'src/data/destiny2/__data_check__.ts')
const source = `import type { Weapon, Release } from '../../types/weapon';
const weapons = ${JSON.stringify(weapons)} satisfies Weapon[];
const releases = ${JSON.stringify(releases)} satisfies Release[];`
const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ESNext }
const host = ts.createCompilerHost(options)
const originalGetSourceFile = host.getSourceFile.bind(host)
host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) =>
  name === filename
    ? ts.createSourceFile(name, source, languageVersion, true)
    : originalGetSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile)
const program = ts.createProgram([filename], options, host)
const diagnostics = ts.getPreEmitDiagnostics(program)
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (name) => name,
    getCurrentDirectory: () => root,
    getNewLine: () => '\n',
  }))
  process.exit(1)
}

function unique(values, label) {
  assert.equal(new Set(values).size, values.length, `Duplicate ${label}`)
}
unique(weapons.map((weapon) => weapon.id), 'weapon ID')
unique(weapons.map((weapon) => `${weapon.edition}:${weapon.name.toLowerCase()}`), 'weapon name')
unique(releases.map((release) => release.id), 'release ID')
unique(releases.map((release) => `${release.edition}:${release.order}`), 'release order')
const releaseMap = new Map(releases.map((release) => [release.id, release]))
for (const weapon of weapons) {
  const first = releaseMap.get(weapon.firstReleaseId)
  assert(first && first.edition === weapon.edition, `Invalid first release: ${weapon.id}`)
  assert(weapon.versions.length > 0, `No versions: ${weapon.id}`)
  unique(weapon.versions.map((version) => version.id), `version ID in ${weapon.id}`)
  const current = weapon.versions.find((version) => version.id === weapon.currentVersionId)
  assert(current, `Missing current version: ${weapon.id}`)
  for (const version of weapon.versions) {
    const release = releaseMap.get(version.releaseId)
    assert(release && release.edition === weapon.edition, `Invalid version release: ${version.id}`)
    assert(release.order >= first.order, `Version predates weapon: ${version.id}`)
    assert(release.order <= releaseMap.get(current.releaseId).order, `Current version is older: ${weapon.id}`)
    assert(version.damageTypes.length > 0, `Missing damage: ${version.id}`)
    unique(version.damageTypes, `damage type in ${version.id}`)
    if (version.champion.counters === null) {
      assert(version.notes, `Unverified counter needs an explanation: ${version.id}`)
    } else {
      assert(version.champion.counters.length > 0, `Missing counter: ${version.id}`)
      unique(version.champion.counters, `Champion counter in ${version.id}`)
    }
    assert(version.referenceUrls.length > 0, `Missing references: ${version.id}`)
    for (const url of version.referenceUrls) assert.equal(new URL(url).protocol, 'https:')
  }
}
const ready = weapons.filter((weapon) =>
  weapon.versions.find((version) => version.id === weapon.currentVersionId).champion.counters !== null,
)
console.log(`Weapon data valid: ${weapons.length} weapons, ${ready.length} ready, ${releases.length} releases.`)
