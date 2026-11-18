import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'

const directory = new URL('../data/character-research/', import.meta.url)
const data = JSON.parse(await readFile(new URL('candidates.json', directory), 'utf8'))
const statuses = new Set(['researched', 'curated', 'confirmed', 'proposed', 'missing'])
const fields = ['species', 'gender', 'guardianClass', 'affiliations', 'roles', 'debutGame', 'firstDestiny2Release']
const labels = ['Being type', 'Gender', 'Guardian class', 'Affiliation', 'Role', 'Debut game', 'First D2 appearance']
const releases = new Map(data.releaseCatalog.map(release => [release.id, release]))
const ids = new Set()
const totals = Object.fromEntries([...statuses].map(status => [status, 0]))
let flaggedCharacters = 0
let editorialReviews = 0
const needsReview = field => ['proposed', 'missing'].includes(field.status) || field.reviewRequired === true
for (const release of releases.values()) {
  assert(Number.isInteger(release.seasonNumber) && release.seasonNumber > 0, 'Season number required')
  assert(Number.isInteger(release.year), 'Release year required')
}

function display(key, field) {
  const value = field.value
  let text = value === null ? '—' : Array.isArray(value) ? value.join(', ') : String(value)
  if (key === 'debutGame' && value) text = value === 'destiny1' ? 'Destiny 1' : 'Destiny 2'
  if (key === 'firstDestiny2Release' && value) {
    const release = releases.get(value)
    text = `S${release.seasonNumber}: ${release.name} (${release.year})`
  }
  return text.replaceAll('|', '\\|')
}

assert.equal(data.characters.length, 82, 'Keep all 82 approved characters')
assert.deepEqual(data.fieldOrder, fields)
for (const character of data.characters) {
  assert(character.id && character.name && !ids.has(character.id), 'Unique ID and name required')
  ids.add(character.id)
  assert.equal(character.edition, 'destiny2')
  assert.deepEqual(Object.keys(character.fields), fields)
  let flagged = false
  for (const key of fields) {
    const field = character.fields[key]
    assert(statuses.has(field.status), `${character.name}: invalid ${key} status`)
    if (field.status === 'missing') assert.equal(field.value, null, `${character.name}: missing values must be null`)
    if (field.value === null) assert(['missing', 'confirmed', 'curated'].includes(field.status), `${character.name}: blank must be missing, explicitly confirmed or documented as curated`)
    if (field.value === null && field.status === 'curated') assert(field.note.trim(), 'Explain an intentionally unrecorded curated value')
    if (field.status === 'confirmed') {
      assert.equal(field.confirmedBy, 'user', 'Confirmed values require a user decision')
      assert(field.note.trim(), 'Explain confirmed classification or intentional blank')
    }
    assert(field.sources.length && field.sources.every(source => source.startsWith('https://')), 'Source required')
    if (field.reviewRequired !== undefined) assert.equal(typeof field.reviewRequired, 'boolean', 'Review marker must be boolean')
    if (field.reviewRequired && !['proposed', 'missing'].includes(field.status)) editorialReviews++
    if (needsReview(field)) {
      assert(field.note.trim(), `${character.name}: explain ${key} review requirement`)
      flagged = true
    }
    if (field.value !== null) {
      if (['affiliations', 'roles'].includes(key)) {
        assert(Array.isArray(field.value) && field.value.length && field.value.every(value => typeof value === 'string' && value.trim()), 'Nonempty string array required')
      } else assert(typeof field.value === 'string' && field.value.trim(), 'Nonempty string required')
    }
    if (key === 'firstDestiny2Release') assert(releases.has(field.value), 'Release must exist in research catalog')
    if (key === 'debutGame') assert(['destiny1', 'destiny2'].includes(field.value), 'Invalid debut game')
    totals[field.status]++
  }
  if (flagged) flaggedCharacters++
}

let overview = '# Character overview\n\nGenerated from [candidates.json](candidates.json). Edit that file, then run `node scripts/character-research.mjs --write`.\n\n'
overview += '`⚠` = proposed value or editorial choice needing review. `❓` = missing: manual research needed. `—` without a marker is an intentional blank documented in its field note. Other values are user decisions, researched facts or editorial mappings. Location is excluded from clues; its notes remain in `backgroundResearch.locations`.\n\n'
overview += `| Character | ${labels.join(' | ')} |\n| ${Array(fields.length + 1).fill('---').join(' | ')} |\n`
let review = '# Manual review checklist\n\nGenerated from [candidates.json](candidates.json). Includes proposed values, missing data and editorial choices explicitly marked for review.\n\n'
review += `${data.characters.length} characters; ${flaggedCharacters} have at least one review item. ${totals.proposed} proposed values, ${totals.missing} missing values and ${editorialReviews} editorial field decisions need attention.\n\n`
if (flaggedCharacters === 0) review += 'All previously flagged clue fields have user decisions. Intentional blanks and excluded location research do not require further review.\n\n'
let notes = '\n## Field notes\n\nThese explain identity, date and classification choices, including researched values with important caveats.\n\n'
for (const character of data.characters) {
  overview += `| [${character.name}](${character.fields.species.sources[0]}) | `
  overview += fields.map(key => {
    const field = character.fields[key]
    const marker = field.status === 'missing' ? ' ❓' : needsReview(field) ? ' ⚠' : ''
    return display(key, field) + marker
  }).join(' | ') + ' |\n'
  const flagged = fields.filter(key => needsReview(character.fields[key]))
  if (flagged.length) {
    review += `## ${character.name}\n\n`
    for (const key of flagged) {
      const field = character.fields[key]
      review += `- [ ] **${labels[fields.indexOf(key)]}: ${display(key, field)}** (${field.reviewRequired ? 'editorial review' : field.status}). ${field.note} [Source](${field.sources[0]})\n`
    }
    review += '\n'
  }
  const annotated = fields.filter(key => character.fields[key].note)
  if (annotated.length) {
    notes += `### ${character.name}\n\n`
    for (const key of annotated) notes += `- **${labels[fields.indexOf(key)]}:** ${character.fields[key].note}\n`
    notes += '\n'
  }
}
const outputs = { 'overview.md': overview + notes, 'review.md': review }
if (process.argv.includes('--write')) {
  for (const [file, contents] of Object.entries(outputs)) await writeFile(new URL(file, directory), contents)
} else {
  for (const [file, contents] of Object.entries(outputs)) {
    assert.equal(await readFile(new URL(file, directory), 'utf8'), contents, `${file} is stale; run with --write`)
  }
}
console.log(`Character research valid: ${ids.size} characters, ${totals.proposed} proposed fields, ${totals.missing} missing fields, ${editorialReviews} editorial decisions (${flaggedCharacters} characters to review).`)
