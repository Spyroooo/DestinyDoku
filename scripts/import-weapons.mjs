import { parseArgs } from 'node:util'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCandidates } from './lib/weapon-import.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const { values } = parseArgs({ options: {
  manifest: { type: 'string' }, collectibles: { type: 'string' },
  output: { type: 'string', default: 'data/weapon-import/trial' },
  overrides: { type: 'string', default: 'data/weapon-import/overrides.json' },
  limit: { type: 'string', default: '50' }, help: { type: 'boolean' },
} })
if (values.help) {
  console.log('npm run data:import -- [--limit 50|all] [--manifest items.json --collectibles collectibles.json] [--output directory] [--overrides file]')
  process.exit(0)
}
const limit = values.limit === 'all' ? Infinity : Number(values.limit)
if (!(limit > 0 && (limit === Infinity || Number.isSafeInteger(limit)))) throw new Error('--limit must be a positive integer or all')
const output = path.resolve(root, values.output)
// Candidate generation must never write into the runtime catalog or public assets.
const relativeOutput = path.relative(root, output)
if (!relativeOutput || relativeOutput.startsWith('..') || ['src', 'public', '.git', 'scripts', '.github', 'node_modules'].includes(relativeOutput.split(path.sep)[0])) {
  throw new Error('--output must be a dedicated directory inside the workspace, outside src/public/config directories')
}
const json = async (filename) => JSON.parse(await readFile(filename, 'utf8'))
async function getJson(url) {
  console.log(`Downloading ${url}`)
  const response = await fetch(url, { signal: AbortSignal.timeout(180000) })
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`)
  return response.json()
}
let items, collectibles, provenance
if (values.manifest) {
  const filename = path.resolve(values.manifest)
  const bytes = await readFile(filename)
  items = JSON.parse(bytes)
  collectibles = values.collectibles ? await json(path.resolve(values.collectibles)) : {}
  provenance = { mode: 'offline', manifestVersion: null, itemSha256: createHash('sha256').update(bytes).digest('hex') }
} else {
  const metadata = await getJson('https://www.bungie.net/Platform/Destiny2/Manifest/')
  if (metadata.ErrorCode !== 1) throw new Error(`Manifest request failed: ${metadata.ErrorStatus}`)
  const paths = metadata.Response?.jsonWorldComponentContentPaths?.en
  if (!paths?.DestinyInventoryItemDefinition || !paths?.DestinyCollectibleDefinition) throw new Error('Manifest missing English definitions')
  const url = (value) => {
    if (!value.startsWith('/common/destiny2_content/')) throw new Error('Unexpected Manifest download path')
    return `https://www.bungie.net${value}`
  }
  const cache = path.join(root, '.cache/weapon-import')
  let cachedMetadata
  try { cachedMetadata = await json(path.join(cache, 'manifest.json')) } catch { /* First run. */ }
  if (cachedMetadata?.Response?.version === metadata.Response.version &&
    cachedMetadata?.Response?.jsonWorldComponentContentPaths?.en?.DestinyInventoryItemDefinition === paths.DestinyInventoryItemDefinition &&
    cachedMetadata?.Response?.jsonWorldComponentContentPaths?.en?.DestinyCollectibleDefinition === paths.DestinyCollectibleDefinition) {
    console.log('Using cached definition files for the unchanged Manifest version.')
    items = await json(path.join(cache, 'items.json'))
    collectibles = await json(path.join(cache, 'collectibles.json'))
  } else {
    items = await getJson(url(paths.DestinyInventoryItemDefinition))
    collectibles = await getJson(url(paths.DestinyCollectibleDefinition))
    await mkdir(cache, { recursive: true })
    await writeFile(path.join(cache, 'items.json'), JSON.stringify(items))
    await writeFile(path.join(cache, 'collectibles.json'), JSON.stringify(collectibles))
    // Write metadata last, only after both tables have downloaded successfully.
    await writeFile(path.join(cache, 'manifest.json'), JSON.stringify(metadata, null, 2))
  }
  provenance = { mode: 'online', manifestVersion: metadata.Response.version,
    itemUrl: url(paths.DestinyInventoryItemDefinition), collectibleUrl: url(paths.DestinyCollectibleDefinition) }
}
if (!items || Array.isArray(items) || !Object.values(items).some((item) => item?.itemType === 3)) throw new Error('Expected a DestinyInventoryItemDefinition object')
const overrides = await json(path.resolve(root, values.overrides))
if (overrides.schemaVersion !== 1 || !overrides.weapons || typeof overrides.weapons !== 'object' || Array.isArray(overrides.weapons)) throw new Error('Unsupported override format')
const curated = await json(path.join(root, 'src/data/destiny2/weapons.json'))
const releases = await json(path.join(root, 'src/data/destiny2/releases.json'))
const releaseIds = new Set(releases.map((release) => release.id))
for (const [id, override] of Object.entries(overrides.weapons)) {
  const releaseReferences = [override.firstReleaseId, ...Object.values(override.versions ?? {}).map((version) => version.releaseId)].filter(Boolean)
  if (releaseReferences.some((release) => !releaseIds.has(release))) throw new Error(`Unknown release ID in override: ${id}`)
}
const { candidates, totalGroups, totalItems } = buildCandidates(items, collectibles, overrides, limit, curated)
for (const candidate of candidates) {
  if (!candidate.currentItemHash || !candidate.firstReleaseId) continue
  const current = candidate.versions.find((version) => version.itemHash === candidate.currentItemHash)
  if (current.releaseId && releases.find((release) => release.id === current.releaseId).order < releases.find((release) => release.id === candidate.firstReleaseId).order) {
    throw new Error(`Selected version predates first introduction: ${candidate.id}`)
  }
}
const report = { schemaVersion: 1, provenance, summary: {
  eligibleManifestItems: totalItems, groupedWeaponNames: totalGroups,
  trialWeapons: candidates.length, reviewed: candidates.filter((entry) => entry.status === 'reviewed').length,
  needsReview: candidates.filter((entry) => entry.status === 'needs-review').length,
}, candidates }
await mkdir(output, { recursive: true })
await writeFile(path.join(output, 'candidates.json'), JSON.stringify(report, null, 2) + '\n')
const drafts = candidates.filter((candidate) => candidate.status === 'reviewed').map((candidate) => {
  const current = candidate.versions.find((version) => version.itemHash === candidate.currentItemHash)
  const versionId = `${candidate.id}-${current.itemHash}`
  return { id: candidate.id, name: candidate.name, edition: 'destiny2', rarity: current.rarity,
    aliases: candidate.aliases, firstReleaseId: candidate.firstReleaseId, currentVersionId: versionId,
    icon: `images/weapons/${candidate.id}.jpg`,
    versions: [{ id: versionId, releaseId: current.releaseId, weaponType: current.weaponType,
      slot: current.slot, ammoType: current.ammoType, damageTypes: current.damageTypes,
      frame: current.frame, champion: current.champion, source: current.source,
      referenceUrls: [`https://www.bungie.net/Platform/Destiny2/Manifest/DestinyInventoryItemDefinition/${current.itemHash}/`],
    }],
  }
})
await writeFile(path.join(output, 'reviewed-drafts.json'), JSON.stringify(drafts, null, 2) + '\n')
const escape = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')
const markdown = ['# Weapon import review', '', 'Generated candidates only. The playable catalog has not been modified.', '',
  `Eligible definitions: ${totalItems}. Grouped names: ${totalGroups}. Selected: ${candidates.length}.`, '',
  'Champion suggestions are evidence for review, not approved facts. Item hashes are not chronological.', '',
  '| Weapon | Variants | Review items |', '| --- | ---: | --- |',
  ...candidates.map((candidate) => `| ${escape(candidate.name)} | ${candidate.versions.length} | ${escape(candidate.review.join('; ') || 'Reviewed; validate before promotion')} |`), '',
  'Edit ../overrides.json using the instructions in ../README.md, then rerun the import. Review all candidates before copying approved entries into the game.', '']
await writeFile(path.join(output, 'review.md'), markdown.join('\n'))
console.log(JSON.stringify(report.summary, null, 2))
console.log(`Review generated at ${path.relative(root, output)}; runtime dataset unchanged.`)
