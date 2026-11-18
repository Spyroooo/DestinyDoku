import assert from 'node:assert/strict'
import { readFile, writeFile, access } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const research = JSON.parse(await readFile(new URL('data/character-research/candidates.json', root), 'utf8'))
const portraits = JSON.parse(await readFile(new URL('data/character-research/portraits.json', root), 'utf8'))
const ids = new Set()
const characters = []
for (const candidate of research.characters) {
  assert(!ids.has(candidate.id), 'Duplicate character ID')
  ids.add(candidate.id)
  const fields = candidate.fields
  assert(Object.values(fields).every(field => !['proposed', 'missing'].includes(field.status)), `${candidate.name}: unresolved clue`)
  const portrait = portraits.find(entry => entry.id === candidate.id)
  assert(portrait?.path, `${candidate.name}: portrait required`)
  await access(new URL(`public${portrait.path}`, root))
  assert(research.releaseCatalog.some(release => release.id === fields.firstDestiny2Release.value), 'Missing release')
  characters.push({
    id: candidate.id, edition: candidate.edition, name: candidate.name, aliases: candidate.aliases,
    icon: portrait.path, species: fields.species.value, gender: fields.gender.value,
    guardianClass: fields.guardianClass.value === 'Not applicable' ? 'None' : fields.guardianClass.value,
    affiliations: fields.affiliations.value, roles: fields.roles.value,
    debutGame: fields.debutGame.value, firstReleaseId: fields.firstDestiny2Release.value,
  })
}
assert.equal(characters.length, 82, 'All 82 approved characters must be included')
const output = `${JSON.stringify({ characters, releases: research.releaseCatalog }, null, 2)}\n`
const target = new URL('src/data/destiny2/characters.json', root)
if (process.argv.includes('--check')) assert.equal(await readFile(target, 'utf8'), output, 'Character data is stale; run node scripts/build-character-data.mjs')
else await writeFile(target, output)
console.log(`${characters.length} playable characters ${process.argv.includes('--check') ? 'validated' : 'generated'} with portraits and documented clues.`)
const pending = research.characters.flatMap(character => Object.values(character.fields).filter(field => field.reviewRequired))
if (pending.length) console.log(`${pending.length} editorial clue decisions remain marked for review before posting; see data/character-research/review.md.`)
