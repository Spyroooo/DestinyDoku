import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCandidates } from './lib/weapon-import.mjs'
import { explicitSource, verifiedChampion, verifiedDamage, gameplayFingerprint } from './lib/weapon-review-rules.mjs'
const root=fileURLToPath(new URL('../',import.meta.url))
const read=async(file)=>JSON.parse(await readFile(path.join(root,file),'utf8'))
const write=async(file,data)=>writeFile(path.join(root,file),JSON.stringify(data,null,2)+'\n')
const items=await read('.cache/weapon-import/items.json'),collectibles=await read('.cache/weapon-import/collectibles.json')
const history=await read('data/weapon-import/research/season-history.json'),groups=await read('data/weapon-import/research/source-groups.json')
const watermarks=await read('data/weapon-import/research/watermark-to-season.json'),sourceSeasons=await read('data/weapon-import/research/source-to-season.json')
const overrides=await read('data/weapon-import/overrides.json'),catalog=await read('src/data/destiny2/weapons.json'),releases=await read('src/data/destiny2/releases.json')
const confirmations=await read('data/weapon-import/research/user-confirmations.json').catch((error)=>{if(error.code==='ENOENT')return {weapons:{}};throw error})
const lightggChecks=await read('data/weapon-import/research/lightgg-release-checks.json')
const lightggConfirmed=new Map(lightggChecks.checks.filter((check)=>check.status==='verified'&&check.evidence?.season===check.seasonNumber).map((check)=>[check.id,check]))
const championChecks=await read('data/weapon-import/research/lightgg-champion-checks.json')
const championEvidence=new Map(championChecks.checks.map((check)=>[check.itemHash,check]))
const sourceChecks=await read('data/weapon-import/research/source-category-checks.json')
const sourceEvidence=new Map(sourceChecks.checks.map((check)=>[check.itemHash,check]))
const archiveChecks=await read('data/weapon-import/research/archive-source-checks.json')
const acquisitionEvidence=new Map(archiveChecks.checks.filter((check)=>check.status==='verified').map((check)=>[check.itemHash,check]))
const damageChecks=await read('data/weapon-import/research/exotic-damage-checks.json')
const damageEvidence=new Map(damageChecks.checks.map((check)=>[check.itemHash,check]))
const patch='https://www.bungie.net/7/en/News/Article/destiny_update_9_7_0'
const sourceRef='https://github.com/DestinyItemManager/d2-additional-info/blob/master/output/source-to-season-v2.json'
const watermarkRef='https://github.com/DestinyItemManager/d2-additional-info/blob/master/output/watermark-to-season.json'
const backup=path.join(root,'.local/weapon-review/backups',`audit-${new Date().toISOString().replace(/[:.]/g,'-')}`)
await mkdir(backup,{recursive:true})
for(const [file,name]of[['data/weapon-import/overrides.json','overrides.json'],['src/data/destiny2/releases.json','releases.json']])await writeFile(path.join(backup,name),await readFile(path.join(root,file)))
const extra=[
 [2,'osiris','Curse of Osiris',2017,'expansion'],[3,'warmind','Warmind',2018,'expansion'],[5,'forge','Season of the Forge',2018,'season'],[7,'opulence','Season of Opulence',2019,'season'],
 [9,'dawn','Season of Dawn',2019,'season'],[10,'worthy','Season of the Worthy',2020,'season'],[14,'splicer','Season of the Splicer',2021,'season'],[15,'lost','Season of the Lost',2021,'season'],
 [22,'witch','Season of the Witch',2023,'season'],[23,'wish','Season of the Wish',2023,'season'],[24,'echoes','Episode: Echoes',2024,'episode'],[25,'revenant','Episode: Revenant',2024,'episode'],[27,'edge-of-fate','The Edge of Fate / Reclamation',2025,'expansion'],
]
for(const [seasonNumber,id,name,year,kind]of extra)if(!releases.some((r)=>r.id===id))releases.push({id,name,edition:'destiny2',year,kind,seasonNumber,order:seasonNumber*100})
releases.sort((a,b)=>a.order-b.order)
const seasonIds=new Map(releases.filter((r)=>r.id!=='anniversary').map((r)=>[r.seasonNumber,r.id]))
const {candidates}=buildCandidates(items,collectibles,overrides,Infinity,catalog)
const trial=new Set((await read('data/weapon-import/trial/candidates.json')).candidates.map((c)=>c.id))
const explicitFirst={ '1000-yard-stare':'anniversary','18-kelvins':'warmind','a-cold-sweat':'osiris','a-distant-pull':'deep','a-single-clap':'red-war','a-sudden-death':'red-war','a-swift-verdict':'red-war',
 'aberrant-action':'echoes','abide-the-return':'forsaken','abyss-defiant':'witch','abyssal-edge':'heresy','acantha-d':'red-war','acantha-d-xk8434':'forge','acasia-s-dejection':'lightfall',
 'accrued-redemption':'undying','ace-of-spades':'forsaken','adhortative':'undying','adjudicator':'red-war','admetus-d':'heresy','adored':'beyond-light','adverse-possession-ix':'osiris','afterlight':'heresy','agamid':'warmind','agape':'edge-of-fate','age-old-bond':'forsaken','21-delirium':'drifter','a-fine-memorial':'undying','accelerando-42':'monument','action-item':'renegades','acosmic':'witch','adamantite':'heresy' }
const manualSource={ 'apex-predator':['raid','Last Wish'],'age-old-bond':['raid','Last Wish'],'a-distant-pull':['seasonal','Season of the Deep activities'], 'wish-ender':['dungeon','The Shattered Throne / Hunter’s Remembrance'], 'leviathans-breath':['quest','Make Bows, Not War'], 'thunderlord':['event','Festival of the Lost 2018 / Exotic quest'], 'ace-of-spades':['quest','Cayde’s Will'], 'acosmic':['event','Festival of the Lost'] }
const exoticCounters={ 'wish-ender':'barrier','leviathans-breath':'unstoppable','thunderlord':'overload','final-warning':'overload','ace-of-spades':'barrier' }
function season(v){const item=items[v.itemHash];if(item.traitIds?.includes('releases.v970.core'))return 29;return watermarks[item.iconWatermark]??history[v.itemHash]??null}
function releaseId(v){const n=season(v);const src=v.sourceText??'';if(n===15&&/Grasp of Avarice|Xûr.*Eternity|Magnum Opus|And Out Fly|30th/.test(src))return 'anniversary';return seasonIds.get(n)??null}
const groupCategories = {
  raid:'raid',lastwish:'raid',deepstonecrypt:'raid',gardenofsalvation:'raid',vowofthedisciple:'raid',vaultofglass:'raid',crotasend:'raid',kingsfall:'raid',rootofnightmares:'raid',salvationsedge:'raid',desertperpetual:'raid',leviathan:'raid',crownofsorrow:'raid',scourgeofthepast:'raid',eow:'raid',spireofstars:'raid',
  dungeon:'dungeon',prophecy:'dungeon',grasp:'dungeon',pit:'dungeon',duality:'dungeon',spireofthewatcher:'dungeon',ghostsofthedeep:'dungeon',warlordsruin:'dungeon',vespershost:'dungeon',sundereddoctrine:'dungeon',equilibrium:'dungeon',shatteredthrone:'dungeon',
  nightfall:'nightfall',crucible:'crucible',ironbanner:'crucible',trials:'crucible',saint14:'crucible',gambit:'gambit',gambitprime:'gambit',legendaryengram:'world-loot',gunsmith:'world-loot',events:'event',sparrowracingleague:'event',
  exoticquest:'quest',avalon:'quest',harbinger:'quest',presage:'quest',oblation:'quest',evidenceboard:'quest',
  heresy:'seasonal',echoes:'seasonal',revenant:'seasonal',menagerie:'seasonal',blackarmory:'seasonal',sundial:'seasonal',vexoffensive:'seasonal',plunder:'seasonal',haunted:'seasonal',sonar:'seasonal',wrathborn:'seasonal',wartable:'seasonal',psiops:'seasonal',servitor:'seasonal',lost:'seasonal',rivenslair:'seasonal',contact:'seasonal',
  moon:'activity',dreaming:'activity',edz:'activity',titan:'activity',nessus:'activity',io:'activity',mars:'activity',mercury:'activity',europa:'activity',paleheart:'activity',throneworld:'activity',kepler:'activity',neomuna:'activity',strikes:'activity',pinnacleops:'activity',riteofthenine:'activity',intothelight:'activity',brave:'activity',
}
function groupedSource(v) {
  const sourceHash=collectibles[String(items[v.itemHash].collectibleHash)]?.sourceHash
  const matches=Object.entries(groups).filter(([key,value])=>groupCategories[key]&&(value.itemHashes?.includes(Number(v.itemHash))||sourceHash&&value.sourceHashes?.includes(sourceHash)))
  const ranked=matches.filter(([key])=>!['raid','dungeon','strikes'].includes(key)).concat(matches.filter(([key])=>['raid','dungeon','strikes'].includes(key)))
  const categories=new Set(ranked.map(([key])=>groupCategories[key]))
  // A narrow Nightfall classification is more specific than the generic Strikes tag.
  if(categories.has('nightfall'))categories.delete('activity')
  if(categories.size!==1)return null
  const category=[...categories][0],match=ranked.find(([key])=>groupCategories[key]===category)
  return {category,name:`${match[0]} (DIM curated source group)`}
}
function source(v){
 const explicit=explicitSource(v.sourceText)
 if(explicit)return explicit
 const raw=v.sourceText?.trim(),text=raw?.replace(/^Source:\s*/,'')
 if(!text||/^Random Perks:|Exotic Archive|Season Pass Reward|Earn Ranks in Vanguard/.test(text))return groupedSource(v)
 let category
 if(/\braid\b/i.test(text))category='raid'
 else if(/\bdungeon\b|Equilibrium/i.test(text))category='dungeon'
 else if(/Nightfall/i.test(text))category='nightfall'
 else if(/Trials|Crucible|Iron Banner|Lord Shaxx|Glory Matches|Competitive Division/i.test(text))category='crucible'
 else if(/Gambit|Drifter/i.test(text))category='gambit'
 else if(/\bquest\b|Strider Exotic/i.test(text))category='quest'
 else if(/Solstice|Festival of the Lost|Dawning|Guardian Games|Revelry|Events|Sparrow Racing/i.test(text))category='event'
 else if(/Season of|Episode:|Episode Revenant|Menagerie|Black Armory forge|Contact Public Event|Sundial|Vex Offensive/i.test(text))category='seasonal'
 else if(/Legendary engrams|Exotic engrams|world drop|Banshee-44|Gunsmith/i.test(text))category='world-loot'
 else if(/Explor|activities|rank-up packages|Dares|Treasure Hoard|Into the Light|Rite of the Nine|strikes|Pinnacle Ops/i.test(text))category='activity'
 if(!category)return groupedSource(v)
 return {category,name:text}
}
function counter(v){
 if(v.rarity==='exotic')return exoticCounters[v.id]??null
 const f=v.frame??''
 if(/^(Adaptive Frame|Adaptive Glaive|Precision Frame|Pinpoint Slug Frame|Legacy PR-55 Frame|Caster Frame|Disruption Weapon)/.test(f))return 'barrier'
 if(/^(Rapid-Fire Frame|Rapid-Fire Glaive|Rapid Fire Slug|Lightweight Frame|Vortex Frame|Support Frame|Area Denial Frame|Dynamic Heat Weapon|Balanced Heat Weapon|Spread Shot)/.test(f))return 'overload'
 if(/^(Aggressive Frame|Aggressive Glaive|High-Impact Frame|High-Impact Longbow|Aggressive Burst|Wave Frame|Wave Sword Frame|Double Fire|Compressed Wave Frame)/.test(f))return 'unstoppable'
 if(f==='Adaptive Burst'&&v.weaponType==='linear-fusion-rifle')return 'barrier'
 if(f==='Heavy Burst'&&['hand-cannon','pulse-rifle'].includes(v.weaponType))return 'unstoppable'
 if(f==='Micro-Missile Frame'&&['grenade-launcher','sidearm','pulse-rifle'].includes(v.weaponType))return 'unstoppable'
 return null
}
const records=[]
for(const c of candidates){
 const confirmation=confirmations.weapons[c.id]
 const lightgg=lightggConfirmed.get(c.id)
 // S15 also contains the separate 30th Anniversary release.
 const lightggFirst=lightgg&&(['hero-of-ages','matador-64'].includes(c.id)?'anniversary':lightgg.releaseId)
 const saved=overrides.weapons[c.id]??{},existing=catalog.find((w)=>w.id===c.id)
 const standard=c.versions.filter((v)=>v.variant==='standard'),known=standard.filter((v)=>season(v)!==null)
 const reasons=[],facts=[],earliest=known.length?Math.min(...known.map(season)):null
 let first=confirmation?.firstReleaseId??lightggFirst??explicitFirst[c.id]??saved.firstReleaseId??existing?.firstReleaseId??null
 if(lightgg)facts.push(`Proposed first release corroborated against Light.gg Season ${lightgg.seasonNumber}, checked ${lightggChecks.checkedOn}; accepted under the release-only review policy`)
 if(!first&&earliest===1){first='red-war';facts.push('Launch-era retained definition: cannot predate Destiny 2 launch')}
 if(!first&&earliest!==null){
  const originals=standard.filter((v)=>season(v)===earliest)
  const confirmed=originals.find((v)=>sourceSeasons[String(collectibles[String(items[v.itemHash].collectibleHash)]?.sourceHash)]===earliest)
  if(confirmed){first=releaseId(confirmed);facts.push('Original release supported by retained item watermark and source-to-season mapping')}
 }
 if(!first)reasons.push('First introduction: retained watermarks alone cannot prove original release')
 let chosen=null
 if(known.length===standard.length&&known.length){
  const latest=Math.max(...known.map(season)),peers=known.filter((v)=>season(v)===latest)
  const fingerprints=new Set(peers.map((v)=>gameplayFingerprint(v,items[v.itemHash])))
  if(fingerprints.size===1)chosen=peers.sort((a,b)=>Number(Boolean(source(b)))-Number(Boolean(source(a)))||Number(Boolean(items[b.itemHash].collectibleHash))-Number(Boolean(items[a.itemHash].collectibleHash))||Number(a.itemHash)-Number(b.itemHash))[0]
  else reasons.push('Newest season has conflicting gameplay variants')
 }else reasons.push('At least one standard version has an unmapped release watermark; newest version is uncertain')
 // A lone curated Exotic with event watermark retains its documented original identity.
 if(!chosen&&standard.length===1&&existing&&exoticCounters[c.id])chosen=standard[0]
 if(confirmation?.currentItemHash){chosen=standard.find((v)=>v.itemHash===confirmation.currentItemHash);if(!chosen)throw new Error(`User-confirmed hash missing: ${c.id}`)}
 const next={...saved,versions:{...saved.versions}}
 if(first)next.firstReleaseId=first
 for(const v of standard){
  const fields={...next.versions[v.itemHash]}
  const release=releaseId(v)??(standard.length===1&&existing?existing.versions.find((e)=>e.id===existing.currentVersionId)?.releaseId:null)
  if(release)fields.releaseId=release
  if(lightggFirst==='anniversary'&&season(v)===15)fields.releaseId='anniversary'
  const origin=manualSource[c.id]?{category:manualSource[c.id][0],name:manualSource[c.id][1]}:source(v)
  if(origin)fields.source=origin
  if(v.rarity==='legendary'&&v.damageTypes?.length)fields.damageTypes=v.damageTypes
  if(v.rarity==='exotic'&&exoticCounters[c.id])fields.damageTypes=existing?.versions.find((e)=>e.id===existing.currentVersionId)?.damageTypes??v.damageTypes
  if(c.id==='hard-light')fields.damageTypes=['arc','solar','void']
  const reviewedDamage=verifiedDamage(damageEvidence.get(v.itemHash),v.itemHash)
  if(reviewedDamage)fields.damageTypes=reviewedDamage
  const champ=counter({...v,id:c.id})
  if(champ)fields.champion={basis:v.rarity==='exotic'?'exotic-intrinsic':'frame',counters:[champ]}
  const verified=verifiedChampion(championEvidence.get(v.itemHash),v.itemHash)
  if(verified)fields.champion={basis:v.rarity==='exotic'?'exotic-intrinsic':'frame',counters:verified}
  if(sourceEvidence.has(v.itemHash)&&!manualSource[c.id])fields.source=sourceEvidence.get(v.itemHash).source
  if(acquisitionEvidence.has(v.itemHash))fields.source=acquisitionEvidence.get(v.itemHash).source
  Object.assign(fields,confirmation?.versions?.[v.itemHash]??{})
  if(Object.keys(fields).length)next.versions[v.itemHash]=fields
 }
 if(chosen){
  next.currentItemHash=chosen.itemHash
  const fields=next.versions[chosen.itemHash]
  if(!fields.releaseId)reasons.push('Selected version release is unverified')
  if(!fields.source)reasons.push('Selected version source is missing or too vague')
  if(!fields.champion)reasons.push('Champion counter requires an Exotic/custom-frame exception check')
  if(!fields.damageTypes?.length)reasons.push('Alternate damage types require an Exotic-specific check')
  facts.push(`Selected newest mapped standard definition ${chosen.itemHash}; equivalent same-season variants grouped`)
  if(verifiedChampion(championEvidence.get(chosen.itemHash),chosen.itemHash))facts.push(`Champion property confirmed on exact Light.gg item page (${championChecks.checkedOn})`)
  if(sourceEvidence.has(chosen.itemHash))facts.push(sourceEvidence.get(chosen.itemHash).method)
  if(acquisitionEvidence.has(chosen.itemHash))facts.push(`Acquisition source reviewed ${archiveChecks.checkedOn}: ${acquisitionEvidence.get(chosen.itemHash).questStatus}`)
  if(verifiedDamage(damageEvidence.get(chosen.itemHash),chosen.itemHash))facts.push(`Exotic firing elements reviewed, including bound catalyst and alternate-mode exceptions (${damageChecks.checkedOn}); ${damageEvidence.get(chosen.itemHash).notes}`)
 }else if(saved.currentItemHash){delete next.currentItemHash}
 if(!next.aliases)next.aliases=c.aliases
 overrides.weapons[c.id]=next
 records.push({id:c.id,name:c.name,trial:trial.has(c.id),currentItemHash:chosen?.itemHash??null,firstReleaseId:first,status:reasons.length?'partial':'complete',unresolved:reasons,evidence:facts,
   ...(confirmation?{userConfirmation:confirmation}:{}),
   ...(lightgg?{lightggReleaseVerification:lightgg}:{}),
   references:[...(confirmation?.referenceUrls??[]),...(acquisitionEvidence.get(chosen?.itemHash)?.referenceUrls??[]),...(damageEvidence.get(chosen?.itemHash)?.referenceUrls??[]),...(chosen&&championEvidence.get(chosen.itemHash)?.status==='verified'?[championEvidence.get(chosen.itemHash).sourceUrl]:[]),...(sourceEvidence.get(chosen?.itemHash)?.referenceUrls??[]),...(lightgg?[lightgg.evidence.url]:[]),patch,watermarkRef,sourceRef,'https://github.com/DestinyItemManager/d2-additional-info/blob/master/output/seasons_backup.json',...(c.id==='ace-of-spades'?['https://masterworked.gg/database/weapons/347366834/ace-of-spades']:[]),...standard.map((v)=>`https://www.bungie.net/Platform/Destiny2/Manifest/DestinyInventoryItemDefinition/${v.itemHash}/`)]})
}
await write('data/weapon-import/overrides.json',overrides)
await write('src/data/destiny2/releases.json',releases)
await write('data/weapon-import/research/audit.json',{date:lightggChecks.checkedOn,manifestVersion:(await read('.cache/weapon-import/manifest.json')).Response.version,summary:{total:records.length,complete:records.filter((r)=>r.status==='complete').length,partial:records.filter((r)=>r.status==='partial').length},records})
const esc=(v)=>String(v).replaceAll('|','\\|')
await writeFile(path.join(root,'data/weapon-import/research/unresolved.md'),['# Weapon review: unresolved cases','',`Reviewed all ${records.length} imported names. Fields supported by direct definitions and documented rules were filled. The cases below need additional historical or Exotic-specific evidence.`, '',
 'A complete record here means structurally resolved using the stated evidence. Source-to-season corroboration or an accepted Light.gg release check is required before deriving first introduction automatically; an unmapped standard version prevents automatic newest-version selection.', '',
 '| Weapon | Remaining uncertainty |','| --- | --- |',...records.filter((r)=>r.status==='partial').map((r)=>`| ${esc(r.name)} | ${esc(r.unresolved.join('; '))} |`),''].join('\n'))
console.log(JSON.stringify({total:records.length,complete:records.filter((r)=>r.status==='complete').length,partial:records.filter((r)=>r.status==='partial').length,backup:path.relative(root,backup)},null,2))
