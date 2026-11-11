import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const idsArgument=process.argv.find((argument)=>argument.startsWith('--ids='))
const selectedIds=idsArgument?new Set(idsArgument.slice(6).split(',')):null
const root=fileURLToPath(new URL('../',import.meta.url))
const read=async(file)=>JSON.parse(await readFile(path.join(root,file),'utf8'))
const audit=await read('data/weapon-import/research/audit.json'),full=await read('data/weapon-import/full/candidates.json'),drafts=await read('data/weapon-import/full/reviewed-drafts.json')
const approved=new Map(audit.records.filter((r)=>r.status==='complete').map((r)=>[r.id,r]))
const catalogPath=path.join(root,'src/data/destiny2/weapons.json'),old=await readFile(catalogPath),catalog=JSON.parse(old)
const backup=path.join(root,'.local/weapon-review/backups',`promote-${new Date().toISOString().replace(/[:.]/g,'-')}`)
await mkdir(backup,{recursive:true});await writeFile(path.join(backup,'weapons.json'),old)
const localDraftPath=path.join(root,'.local/weapon-review/drafts.json')
const oldLocal=await readFile(localDraftPath).catch(()=>null),local=oldLocal?JSON.parse(oldLocal):{}
if(oldLocal)await writeFile(path.join(backup,'drafts.json'),oldLocal)
const overrides=await read('data/weapon-import/overrides.json')
let added=0,updated=0
const sameClues=(a,b)=>['weaponType','slot','ammoType','frame'].every((key)=>a[key]===b[key])&&JSON.stringify(a.damageTypes)===JSON.stringify(b.damageTypes)&&a.source.category===b.source.category&&JSON.stringify(a.champion.counters)===JSON.stringify(b.champion.counters)
for(const draft of drafts){
 if(selectedIds&&!selectedIds.has(draft.id))continue
 const record=approved.get(draft.id);if(!record)continue
 if(!/^[a-z0-9-]+$/.test(draft.id))throw new Error('Unsafe weapon ID')
 const bytes=await readFile(path.join(root,'.cache/weapon-import/approved-icons',draft.id+'.image'))
 const ext=bytes[0]===255&&bytes[1]===216?'jpg':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'webp':null
 if(!ext)throw new Error(`Invalid thumbnail: ${draft.name}`)
 const icon=`images/weapons/${draft.id}-reviewed.${ext}`
 await writeFile(path.join(root,'public',icon),bytes)
 draft.icon=icon
 const current=draft.versions[0]
 current.referenceUrls=[...new Set([...current.referenceUrls,...record.references])]
 current.notes=(record.userConfirmation?`Contains user-confirmed corrections from ${record.userConfirmation.confirmedOn}; see data/weapon-import/research/user-confirmations.json. `:'')+'Reviewed against the cached Bungie Manifest and the linked source/season mappings. Version release is the introduction of this item definition, not a perk or crafting update.'
 if(record.userConfirmation?.confirmationMethod)current.notes+=` First release accepted under the user's bulk proposal policy; this does not represent individual historical verification. See data/weapon-import/research/bulk-release-approval.json.`
 if(record.lightggReleaseVerification)current.notes+=` Proposed first release corroborated using Light.gg Season ${record.lightggReleaseVerification.seasonNumber}; see data/weapon-import/research/lightgg-release-checks.json.`
 const index=catalog.findIndex((w)=>w.id===draft.id),existing=catalog[index]
 if(existing){
  const retained=existing.versions.filter((version)=>version.id!==current.id&&!sameClues(version,current))
  draft.versions=[...retained,current]
  draft.aliases=[...new Set([...existing.aliases,...draft.aliases])]
  catalog[index]=draft;updated++
 }else{catalog.push(draft);added++}
}
// Bring the local checker up to date without discarding existing notes or aliases.
for(const c of full.candidates){
 if(selectedIds&&!selectedIds.has(c.id))continue
 const override=overrides.weapons[c.id];if(!override)continue
 const prior=local[c.id]??{versions:{}}
 const next={...prior,firstReleaseId:override.firstReleaseId??prior.firstReleaseId??'',currentItemHash:override.currentItemHash??'',aliases:[...new Set([...(prior.aliases??[]),...(override.aliases??[])])],versions:{...prior.versions}}
 const record=audit.records.find((r)=>r.id===c.id)
 for(const v of c.versions){
  const facts=override.versions?.[v.itemHash]??{},before=next.versions[v.itemHash]??{}
  next.versions[v.itemHash]={...before,releaseId:facts.releaseId??before.releaseId??'',source:facts.source??before.source??{category:'',name:''},
   damageTypes:facts.damageTypes??before.damageTypes??v.damageTypes??[],champion:facts.champion??before.champion??{basis:v.rarity==='exotic'?'exotic-intrinsic':'frame',counters:[]},
   damageConfirmed:Boolean(facts.damageTypes),championConfirmed:Boolean(facts.champion),referenceUrls:[...new Set([...(before.referenceUrls??[]),...(record?.references??[])])],
   notes:[before.notes?.replace(/(?:^|\n)Audit:.*$/gm,''),`Audit: ${record?.unresolved.join('; ')||'reviewed'}`].filter(Boolean).join('\n')}
 }
 local[c.id]=next
}
try{
 await writeFile(catalogPath,JSON.stringify(catalog,null,2)+'\n')
 execFileSync(process.execPath,['scripts/validate-weapon-data.mjs'],{cwd:root,stdio:'inherit'})
 await writeFile(localDraftPath,JSON.stringify(local,null,2)+'\n')
}catch(error){await writeFile(catalogPath,old);if(oldLocal)await writeFile(localDraftPath,oldLocal);throw error}
console.log(JSON.stringify({added,updated,catalog:catalog.length,backup:path.relative(root,backup)},null,2))
