import { readFile, writeFile } from 'node:fs/promises'
import { explicitSource } from './lib/weapon-review-rules.mjs'
import { identityKey } from './lib/weapon-import.mjs'
const read=async(name)=>JSON.parse(await readFile(new URL(`../${name}`,import.meta.url),'utf8'))
const items=await read('.cache/weapon-import/items.json'),vendors=await read('.cache/weapon-import/vendors.json')
const candidates=(await read('data/weapon-import/full/candidates.json')).candidates
const audit=await read('data/weapon-import/research/audit.json')
const direct=new Map(),pools=new Map()
for(const vendor of Object.values(vendors).filter((v)=>v.vendorIdentifier?.startsWith('TOWER_MOT_TENET_'))){
 for(const sale of vendor.itemList??[]){
  const item=items[String(sale.itemHash)],name=item?.displayProperties?.name
  if(!item||!name)continue
  if(item.itemType===3)direct.set(String(sale.itemHash),{source:{category:'vendor',name:vendor.displayProperties.name},vendorHash:String(vendor.hash),soldItemHash:String(sale.itemHash),method:'Exact weapon hash in Tenet vendor inventory'})
  if(!/Weapon Engram/.test(name))continue
  const previewHash=item.preview?.previewVendorHash,preview=vendors[String(previewHash)]
  if(!preview)continue
  for(const reward of preview.itemList??[]){
   const rewardItem=items[String(reward.itemHash)]
   if(!rewardItem?.displayProperties?.name)continue
   const key=identityKey(rewardItem.displayProperties.name)
   const evidence={source:{category:'tenet-engram',name:`${vendor.displayProperties.name} / ${name}`},vendorHash:String(vendor.hash),engramHash:String(item.hash),previewVendorHash:String(previewHash),rewardHash:String(reward.itemHash),method:'Named reward in the weapon engram preview inventory linked from a Tenet vendor'}
   if(!pools.has(key))pools.set(key,evidence)
  }
 }
}
const checks=[]
for(const record of audit.records){
 const c=candidates.find((c)=>c.id===record.id),v=c.versions.find((v)=>v.itemHash===record.currentItemHash)
 if(!v)continue
 const explicit=explicitSource(v.sourceText)
 const missing=!v.sourceText||/^Random Perks:/.test(v.sourceText)
 const monument=/^Source: Monument of Triumph$/.test(v.sourceText??'')
 // A vendor sale alone does not replace a known raid/event/activity origin.
 const inventory=(missing||monument)&&(!v.source||['tenet-engram','vendor'].includes(v.source.category))?direct.get(v.itemHash)??pools.get(identityKey(c.name)):null
 const match=explicit?{source:explicit,method:'Explicit collectible acquisition text'}:inventory
 if(!match)continue
 checks.push({id:c.id,name:c.name,itemHash:v.itemHash,...match,referenceUrls:[`https://www.bungie.net/Platform/Destiny2/Manifest/DestinyInventoryItemDefinition/${v.itemHash}/`,...(match.vendorHash?[`https://www.bungie.net/Platform/Destiny2/Manifest/DestinyVendorDefinition/${match.vendorHash}/`,`https://www.bungie.net/Platform/Destiny2/Manifest/DestinyVendorDefinition/${match.previewVendorHash??match.vendorHash}/`]:[])]})
}
await writeFile(new URL('../data/weapon-import/research/source-category-checks.json',import.meta.url),JSON.stringify({schemaVersion:1,checkedOn:'2026-11-11',vendorManifestPath:(await read('.cache/weapon-import/manifest.json')).Response.jsonWorldComponentContentPaths.en.DestinyVendorDefinition,checks},null,2)+'\n')
console.log(JSON.stringify({checked:checks.length,counts:checks.reduce((a,c)=>(a[c.source.category]=(a[c.source.category]??0)+1,a),{})}))
