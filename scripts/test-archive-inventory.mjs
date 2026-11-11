import test from 'node:test'
import assert from 'node:assert/strict'
import { archiveInventory, archiveEntryForVersion } from './lib/archive-inventory.mjs'

test('Archive discovery follows the kiosk subvendors and matches exact item versions',()=>{
 const items={10:{preview:{previewVendorHash:2}},20:{itemType:3,displayProperties:{name:'Archived weapon'}}}
 const vendors={1:{hash:1,vendorIdentifier:'TOWER_EXOTIC_ARCHIVE',displayProperties:{name:'Monument to Lost Lights'},itemList:[{itemHash:10}]},2:{hash:2,displayProperties:{name:'Legacy Gear'},itemList:[{itemHash:20},{itemHash:10}]},3:{hash:3,displayProperties:{name:'Unrelated Legacy Gear'},itemList:[{itemHash:30}]}}
 const inventory=archiveInventory(items,vendors)
 assert.equal(inventory.length,1)
 assert.equal(archiveEntryForVersion(inventory,{itemHash:'20'}).vendorHash,'2')
 assert.equal(archiveEntryForVersion(inventory,{itemHash:'21',name:'Archived weapon'}),null)
 assert.equal(archiveEntryForVersion(inventory,{itemHash:'30'}),null)
})
