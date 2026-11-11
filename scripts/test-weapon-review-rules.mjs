import test from 'node:test'
import assert from 'node:assert/strict'
import { explicitSource, verifiedChampion, gameplayFingerprint } from './lib/weapon-review-rules.mjs'

test('reward passes are distinct from seasonal activity drops and vendor sales',()=>{
 assert.equal(explicitSource('Source: Season Pass Reward').category,'season-pass')
 assert.equal(explicitSource('Source: Rewards Pass').category,'season-pass')
 assert.equal(explicitSource('Source: Acquired from Xûr').category,'vendor')
 assert.equal(explicitSource('Source: Season of the Deep activities'),null)
 assert.equal(explicitSource('Source: Exotic Archive at the Tower'),null)
})

test('Champion evidence requires a confirmed exact item page and an unambiguous counter',()=>{
 const check={status:'verified',itemHash:'123',sourceUrl:'https://www.light.gg/db/items/123/example/',counters:['overload']}
 assert.deepEqual(verifiedChampion(check,'123'),['overload'])
 assert.equal(verifiedChampion(check,'456'),null)
 assert.equal(verifiedChampion({...check,status:'not-confirmed'},'123'),null)
 assert.throws(()=>verifiedChampion({...check,sourceUrl:'https://www.light.gg/db/items/456/example/'},'123'))
 assert.throws(()=>verifiedChampion({...check,counters:['overload','barrier']},'123'))
})

test('reviewing an Exotic mode set does not create a false same-season variant conflict',()=>{
 const base={weaponType:'grenade-launcher',slot:'energy',ammoType:'special',frame:'Trinary Vision',damageTypes:['void']}
 const reviewed={...base,damageTypes:['arc','solar','void']}
 assert.equal(gameplayFingerprint(base,{damageTypes:[4]}),gameplayFingerprint(reviewed,{damageTypes:[4]}))
 assert.notEqual(gameplayFingerprint(base,{damageTypes:[4]}),gameplayFingerprint(base,{damageTypes:[2]}))
})
