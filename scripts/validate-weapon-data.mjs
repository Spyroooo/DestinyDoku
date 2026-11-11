import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ts from 'typescript'
import { catalogTypeDiagnostics } from './lib/catalog-type-check.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (name) => JSON.parse(readFileSync(path.join(root, 'src/data/destiny2', name), 'utf8'))
const weapons = read('weapons.json')
const releases = read('releases.json')

// Keep the same application types without inferring one union for the full array.
const diagnostics = catalogTypeDiagnostics(weapons, releases, root)
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
assert(weapons.length > 0, 'Weapon dataset is empty')
unique(weapons.map((weapon) => weapon.id), 'weapon ID')
unique(weapons.map((weapon) => `${weapon.edition}:${weapon.name.toLowerCase()}`), 'weapon name')
unique(releases.map((release) => release.id), 'release ID')
unique(releases.map((release) => `${release.edition}:${release.order}`), 'release order')
for (const release of releases) {
  if (release.seasonNumber !== undefined) assert(Number.isInteger(release.seasonNumber) && release.seasonNumber > 0, `Invalid season number: ${release.id}`)
}
const releaseMap = new Map(releases.map((release) => [release.id, release]))
for (const weapon of weapons) {
  assert(weapon.name.trim() && weapon.id.trim(), 'Empty weapon identity')
  assert(weapon.icon && /^images\/weapons\/[a-z0-9-]+\.(jpg|png|webp)$/.test(weapon.icon), `Invalid icon path: ${weapon.id}`)
  const imagePath = path.join(root, 'public', weapon.icon)
  assert(existsSync(imagePath), `Missing icon file: ${weapon.id}`)
  const bytes = readFileSync(imagePath)
  const validImage = weapon.icon.endsWith('.jpg') ? bytes[0] === 0xff && bytes[1] === 0xd8
    : weapon.icon.endsWith('.png') ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  assert(validImage, `Invalid image file: ${weapon.id}`)
  const first = releaseMap.get(weapon.firstReleaseId)
  assert(first && first.edition === weapon.edition, `Invalid first release: ${weapon.id}`)
  assert(weapon.versions.length > 0, `No versions: ${weapon.id}`)
  unique(weapon.versions.map((version) => version.id), `version ID in ${weapon.id}`)
  const current = weapon.versions.find((version) => version.id === weapon.currentVersionId)
  assert(current, `Missing current version: ${weapon.id}`)
  for (const version of weapon.versions) {
    assert(version.frame.trim() && version.source.name.trim(), `Empty clue: ${version.id}`)
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
