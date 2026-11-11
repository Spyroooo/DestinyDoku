/** Follow only subvendors linked from the actual Exotic Archive kiosk. */
export function archiveInventory(items, vendors) {
 const roots=Object.values(vendors).filter((vendor)=>vendor.vendorIdentifier==='TOWER_EXOTIC_ARCHIVE')
 const queue=roots.map((vendor)=>({hash:String(vendor.hash),route:[]})),seen=new Set(),weapons=new Map()
 while(queue.length){
  const {hash,route}=queue.shift()
  if(seen.has(hash))continue
  seen.add(hash)
  const vendor=vendors[hash]
  if(!vendor)continue
  const nextRoute=[...route,{hash,name:vendor.displayProperties.name}]
  for(const sale of vendor.itemList??[]){
   const itemHash=String(sale.itemHash),item=items[itemHash]
   if(!item)continue
   if(item.itemType===3&&!weapons.has(itemHash))weapons.set(itemHash,{itemHash,name:item.displayProperties.name,vendorHash:hash,route:nextRoute})
   const child=item.preview?.previewVendorHash
   if(child)queue.push({hash:String(child),route:nextRoute})
  }
 }
 return [...weapons.values()]
}

export function archiveEntryForVersion(inventory, version) {
 return inventory.find((entry)=>entry.itemHash===String(version.itemHash))??null
}
