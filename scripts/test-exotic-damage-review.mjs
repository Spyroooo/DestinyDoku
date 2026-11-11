import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { verifiedDamage } from './lib/weapon-review-rules.mjs'
const read=(name)=>JSON.parse(readFileSync(new URL(`../${name}`,import.meta.url),'utf8'))
const checks=read('data/weapon-import/research/exotic-damage-checks.json').checks

test('reviewed damage requires the exact item and rejects absent or invalid evidence',()=>{
 const row=checks[0]
 assert.deepEqual(verifiedDamage(row,row.itemHash),row.damageTypes)
 assert.equal(verifiedDamage(row,'different-item'),null)
 assert.equal(verifiedDamage({...row,status:'pending'},row.itemHash),null)
 assert.throws(()=>verifiedDamage({...row,damageTypes:['arc','arc']},row.itemHash))
 assert.throws(()=>verifiedDamage({...row,referenceUrls:[]},row.itemHash))
})

test('Exotic element exceptions replace placeholder or incomplete base damage',()=>{
 const expected={borealis:['arc','solar','void'],'conditional-finality':['solar','stasis'],'dead-messenger':['arc','solar','void'],'ergo-sum':['arc','solar','void'],'graviton-spike':['arc','stasis'],'quicksilver-storm':['kinetic','strand'],tessellation:['arc','solar','void','stasis','strand'],'touch-of-malice':['kinetic','arc'],'traveler-s-chosen':['kinetic','arc','solar','void','stasis','strand'],'two-tailed-fox':['arc','solar','void'],'whirling-ovation':['solar','strand']}
 const overrides=read('data/weapon-import/overrides.json').weapons
 for(const [id,elements] of Object.entries(expected)){
  const row=checks.find((check)=>check.id===id)
  assert.deepEqual(new Set(verifiedDamage(row,row.itemHash)),new Set(elements),id)
  assert.deepEqual(new Set(overrides[id].versions[row.itemHash].damageTypes),new Set(elements),id)
 }
 assert.deepEqual(checks.find((check)=>check.id==='praxic-blade').damageTypes,['kinetic'])
 assert.deepEqual(checks.find((check)=>check.id==='forerunner').damageTypes,['kinetic'])
})
