// Pure Manifest normalization. Missing history is deliberately not guessed.
const types = new Map([
  ['Auto Rifle', 'auto-rifle'], ['Scout Rifle', 'scout-rifle'], ['Pulse Rifle', 'pulse-rifle'],
  ['Hand Cannon', 'hand-cannon'], ['Submachine Gun', 'submachine-gun'], ['Sidearm', 'sidearm'],
  ['Combat Bow', 'combat-bow'], ['Shotgun', 'shotgun'], ['Sniper Rifle', 'sniper-rifle'],
  ['Fusion Rifle', 'fusion-rifle'], ['Linear Fusion Rifle', 'linear-fusion-rifle'],
  ['Trace Rifle', 'trace-rifle'], ['Grenade Launcher', 'grenade-launcher'],
  ['Rocket Launcher', 'rocket-launcher'], ['Machine Gun', 'machine-gun'], ['Sword', 'sword'], ['Glaive', 'glaive'],
])
const ammo = { 1: 'primary', 2: 'special', 3: 'heavy' }
const damage = { 1: 'kinetic', 2: 'arc', 3: 'solar', 4: 'void', 6: 'stasis', 7: 'strand' }
const slots = { 1498876634: 'kinetic', 2465295065: 'energy', 953998645: 'power' }
const breakers = { 1: 'barrier', 2: 'overload', 3: 'unstoppable' }
const frameCounters = {
  'Aggressive Frame': 'unstoppable', 'High-Impact Frame': 'unstoppable',
  'Precision Frame': 'barrier', 'Adaptive Frame': 'barrier',
  'Lightweight Frame': 'overload', 'Rapid-Fire Frame': 'overload',
  'Wave Frame': 'unstoppable', 'Vortex Frame': 'overload', 'Caster Frame': 'barrier',
  'Legacy PR-55 Frame': 'barrier', 'Pinpoint Slug Frame': 'barrier',
}
export function identityName(name) {
  return name.normalize('NFKC').replace(/’/g, "'")
    .replace(/\s*\((?:Adept|Timelost|Harrowed)\)\s*$/i, '').trim()
}
export function identityKey(name) { return identityName(name).toLowerCase() }
export function slug(name) { return identityKey(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
export function eligible(item) {
  return item.itemType === 3 && item.equippable === true && !item.redacted && !item.blacklisted &&
    [5, 6].includes(item.inventory?.tierType) && Boolean(item.displayProperties?.name?.trim()) &&
    item.inventory?.isInstanceItem === true
}
function versionFromItem(item, items, collectibles) {
  const intrinsic = (item.sockets?.socketEntries ?? [])
    .map((socket) => items[String(socket.singleInitialItemHash)])
    .find((plug) => plug?.plug?.plugCategoryIdentifier === 'intrinsics')
  const rawDamage = item.damageTypes?.length ? item.damageTypes : [item.defaultDamageType]
  const damageTypes = rawDamage.every((value) => damage[value]) ? [...new Set(rawDamage.map((value) => damage[value]))] : null
  const directCounter = breakers[item.breakerType]
  const suggestedCounter = directCounter ?? (item.inventory.tierType === 5 ? frameCounters[intrinsic?.displayProperties?.name] : null)
  const icon = item.displayProperties.icon
  return {
    itemHash: String(item.hash), name: item.displayProperties.name,
    variant: /\((Adept|Timelost|Harrowed)\)$/i.test(item.displayProperties.name) ? 'adept' : 'standard',
    rarity: item.inventory.tierType === 6 ? 'exotic' : 'legendary',
    weaponType: types.get(item.itemTypeDisplayName) ?? null,
    slot: slots[item.equippingBlock?.equipmentSlotTypeHash ?? item.inventory.bucketTypeHash] ?? null,
    ammoType: ammo[item.equippingBlock?.ammoType] ?? null,
    damageTypes, damageReviewRequired: item.inventory.tierType === 6,
    frame: intrinsic?.displayProperties?.name ?? null,
    intrinsicHash: intrinsic ? String(intrinsic.hash) : null,
    championSuggestion: suggestedCounter ? {
      counters: [suggestedCounter], basis: directCounter ? 'item-definition' : 'frame-rule',
    } : null,
    champion: null,
    releaseId: null,
    source: null,
    sourceText: collectibles[String(item.collectibleHash)]?.sourceString ?? null,
    releaseEvidence: { watermark: item.iconWatermark ?? null, traits: item.traitIds ?? [] },
    iconUrl: typeof icon === 'string' && icon.startsWith('/common/') ? `https://www.bungie.net${icon}` : null,
  }
}
function validateOverride(id, override) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) throw new Error(`Invalid override: ${id}`)
  const allowed = ['firstReleaseId', 'currentItemHash', 'aliases', 'versions']
  for (const key of Object.keys(override)) if (!allowed.includes(key)) throw new Error(`Unknown override field: ${id}/${key}`)
  for (const key of ['firstReleaseId', 'currentItemHash']) {
    if (override[key] !== undefined && (typeof override[key] !== 'string' || !override[key].trim())) throw new Error(`Invalid ${key}: ${id}`)
  }
  if (override.aliases !== undefined && (!Array.isArray(override.aliases) || override.aliases.some((value) => typeof value !== 'string' || !value.trim()))) throw new Error(`Invalid aliases: ${id}`)
  if (override.versions !== undefined && (!override.versions || typeof override.versions !== 'object' || Array.isArray(override.versions))) throw new Error(`Invalid versions: ${id}`)
  for (const [hash, version] of Object.entries(override.versions ?? {})) {
    if (!version || typeof version !== 'object' || Array.isArray(version)) throw new Error(`Invalid version override: ${id}/${hash}`)
    for (const field of Object.keys(version)) if (!['releaseId', 'source', 'champion', 'damageTypes'].includes(field)) throw new Error(`Unknown version field: ${id}/${field}`)
    if (version.releaseId !== undefined && (typeof version.releaseId !== 'string' || !version.releaseId.trim())) throw new Error(`Invalid releaseId: ${id}`)
    if (version.source !== undefined) {
      if (!['world-loot', 'raid', 'dungeon', 'quest', 'seasonal', 'crucible', 'gambit', 'nightfall', 'activity', 'event', 'season-pass', 'vendor', 'tenet-engram', 'exotic-archive', 'unreleased'].includes(version.source?.category) || typeof version.source?.name !== 'string' || !version.source.name.trim()) throw new Error(`Invalid source: ${id}`)
    }
    if (version.damageTypes !== undefined && (!Array.isArray(version.damageTypes) || !version.damageTypes.length || version.damageTypes.some((value) => !Object.values(damage).includes(value)) || new Set(version.damageTypes).size !== version.damageTypes.length)) throw new Error(`Invalid damageTypes: ${id}`)
    if (version.champion !== undefined) {
      const champion = version.champion
      if (!['frame', 'exotic-intrinsic'].includes(champion?.basis) || !Array.isArray(champion?.counters) || !champion.counters.length || champion.counters.some((value) => !Object.values(breakers).includes(value)) || new Set(champion.counters).size !== champion.counters.length) throw new Error(`Invalid champion: ${id}`)
    }
  }
}
export function buildCandidates(items, collectibles = {}, overrides = { weapons: {} }, limit = 50, curated = []) {
  for (const [id, override] of Object.entries(overrides.weapons ?? {})) validateOverride(id, override)
  const groups = new Map()
  for (const item of Object.values(items)) {
    if (!eligible(item)) continue
    const key = identityKey(item.displayProperties.name)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(versionFromItem(item, items, collectibles))
  }
  const curatedByName = new Map(curated.map((weapon) => [identityKey(weapon.name), weapon]))
  const groupsById = new Map([...groups.entries()].map(([key, versions]) => {
    const name = identityName(versions.find((version) => version.variant === 'standard')?.name ?? versions[0].name)
    return [curatedByName.get(key)?.id ?? slug(name), versions]
  }))
  if (groupsById.size !== groups.size) throw new Error('Identity slug collision; add explicit grouping rules before proceeding')
  for (const [id, override] of Object.entries(overrides.weapons ?? {})) {
    const versions = groupsById.get(id)
    if (!versions) throw new Error(`Unknown weapon override: ${id}`)
    for (const hash of Object.keys(override.versions ?? {})) {
      if (!versions.some((version) => version.itemHash === hash)) throw new Error(`Unknown version override: ${id}/${hash}`)
    }
    if (override.currentItemHash && !versions.some((version) => version.itemHash === override.currentItemHash && version.variant === 'standard')) {
      throw new Error(`Current item must be an eligible standard version: ${id}/${override.currentItemHash}`)
    }
  }
  const selected = [...groups.entries()].sort(([a], [b]) =>
    Number(curatedByName.has(b)) - Number(curatedByName.has(a)) || a.localeCompare(b, 'en'))
    .slice(0, limit)
  const candidates = selected.map(([key, versions]) => {
    versions.sort((a, b) => a.itemHash.localeCompare(b.itemHash, 'en', { numeric: true }))
    const name = identityName(versions.find((version) => version.variant === 'standard')?.name ?? versions[0].name)
    const id = curatedByName.get(key)?.id ?? slug(name)
    const override = overrides.weapons?.[id] ?? {}
    const review = []
    for (const hash of Object.keys(override.versions ?? {})) {
      if (!versions.some((version) => version.itemHash === hash)) throw new Error(`Unknown version override: ${id}/${hash}`)
    }
    for (const version of versions) {
      const manual = override.versions?.[version.itemHash] ?? {}
      for (const field of ['releaseId', 'source', 'champion', 'damageTypes']) {
        if (manual[field] !== undefined) version[field] = manual[field]
      }
      version.damageReviewRequired = version.rarity === 'exotic' && manual.damageTypes === undefined
    }
    const currentItemHash = override.currentItemHash ?? null
    if (currentItemHash && !versions.some((version) => version.itemHash === currentItemHash && version.variant === 'standard')) {
      throw new Error(`Current item must be an eligible standard version: ${id}/${currentItemHash}`)
    }
    const current = versions.find((version) => version.itemHash === currentItemHash)
    if (!override.firstReleaseId) review.push('Confirm first Destiny 2 release')
    if (!current) review.push('Select current standard item hash; hash order is not release chronology')
    if (current) {
      for (const field of ['weaponType', 'slot', 'ammoType', 'damageTypes', 'frame', 'champion', 'releaseId', 'source', 'iconUrl']) {
        if (!current[field]) review.push(`Confirm current version ${field}`)
      }
      if (current.damageReviewRequired) review.push('Review Exotic alternate damage types')
    }
    return { id, name, edition: 'destiny2', aliases: override.aliases ?? curatedByName.get(key)?.aliases ?? [],
      firstReleaseId: override.firstReleaseId ?? null, currentItemHash,
      curatedReferenceId: curatedByName.get(key)?.id ?? null, versions, review,
      status: review.length ? 'needs-review' : 'reviewed',
    }
  })
  const ids = candidates.map((candidate) => candidate.id)
  if (new Set(ids).size !== ids.length) throw new Error('Identity slug collision; add explicit grouping rules before proceeding')
  return { candidates, totalGroups: groups.size, totalItems: [...groups.values()].reduce((sum, versions) => sum + versions.length, 0) }
}
