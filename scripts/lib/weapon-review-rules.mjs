// Explicit acquisition text takes precedence over broad activity keywords.
export function explicitSource(text) {
  const name=text?.trim().replace(/^Source:\s*/,'')
  if(!name)return null
  if(/^(Season Pass Reward|Rewards? Pass)(?:\b|$)/i.test(name))return {category:'season-pass',name}
  if(/^(?:Acquired from X[ûu]r|Purchas(?:e|ed|able) (?:from|at) (?:a )?(?:vendor|Banshee|X[ûu]r))/i.test(name))return {category:'vendor',name}
  return null
}

export function verifiedChampion(check, itemHash) {
  if(check?.status!=='verified'||String(check.itemHash)!==String(itemHash))return null
  const url=new URL(check.sourceUrl)
  if(url.protocol!=='https:'||url.hostname!=='www.light.gg'||!new RegExp(`/items/${itemHash}/`).test(url.pathname))throw new Error('Champion evidence must identify the exact Light.gg item')
  if(check.counters.length!==1||!['barrier','overload','unstoppable'].includes(check.counters[0]))throw new Error('Ambiguous Champion evidence')
  return check.counters
}

export function verifiedDamage(check, itemHash) {
  if(check?.status!=='verified'||String(check.itemHash)!==String(itemHash))return null
  const elements=check.damageTypes
  if(!Array.isArray(elements)||!elements.length||new Set(elements).size!==elements.length||elements.some((value)=>!['kinetic','arc','solar','void','stasis','strand'].includes(value)))throw new Error('Invalid reviewed damage types')
  if(!check.referenceUrls?.some((reference)=>{
    const url=new URL(reference)
    return url.protocol==='https:'&&((url.hostname==='www.bungie.net'&&url.pathname.endsWith(`/DestinyInventoryItemDefinition/${itemHash}/`))||(url.hostname==='www.light.gg'&&url.pathname.includes(`/items/${itemHash}/`)))
  }))throw new Error('Damage review must identify the exact item definition')
  return [...elements]
}

// Review overrides describe the chosen item's supported modes. They must not
// make an equivalent raw definition look like a conflicting gameplay variant.
export function gameplayFingerprint(version, rawItem) {
 const damage=rawItem.damageTypes?.length?rawItem.damageTypes:[rawItem.defaultDamageType??null]
 return JSON.stringify([version.weaponType,version.slot,version.ammoType,[...new Set(damage)].sort(),version.frame])
}
