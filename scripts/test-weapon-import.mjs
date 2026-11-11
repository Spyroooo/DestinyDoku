import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCandidates, eligible, identityName } from './lib/weapon-import.mjs'

function item(hash, name = 'Example', extra = {}) {
  return { hash, displayProperties: { name, icon: '/common/icon.jpg' }, itemType: 3,
    equippable: true, inventory: { tierType: 5, isInstanceItem: true, bucketTypeHash: 2465295065 },
    itemTypeDisplayName: 'Auto Rifle', equippingBlock: { ammoType: 1 }, damageTypes: [4],
    sockets: { socketEntries: [{ singleInitialItemHash: 99 }] }, ...extra }
}
const frame = { hash: 99, displayProperties: { name: 'Adaptive Frame' }, plug: { plugCategoryIdentifier: 'intrinsics' } }

test('filters non-weapons, recipes, low rarity, redacted and non-equippable definitions', () => {
  assert(eligible(item(1)))
  for (const extra of [{ itemType: 19 }, { equippable: false }, { redacted: true }, { blacklisted: true },
    { inventory: { tierType: 4, isInstanceItem: true } }, { inventory: { tierType: 5, isInstanceItem: false } }]) {
    assert.equal(eligible(item(1, 'Example', extra)), false)
  }
})

test('groups standard and named Adept variants without choosing latest by hash', () => {
  const result = buildCandidates({ 1: item(1), 2: item(2, 'Example (Adept)'), 3: item(3, 'Example'), 99: frame })
  assert.equal(result.candidates.length, 1)
  const candidate = result.candidates[0]
  assert.equal(candidate.versions.length, 3)
  assert.equal(candidate.currentItemHash, null)
  assert.equal(candidate.status, 'needs-review')
  assert.equal(candidate.versions[0].champion, null)
  assert.deepEqual(candidate.versions[0].championSuggestion.counters, ['barrier'])
  assert.equal(identityName('Example (Timelost)'), 'Example')
  assert.equal(identityName('Example (Harrowed)'), 'Example')
})

test('keeps reissue damage separate and preserves unknown damage as unresolved', () => {
  const result = buildCandidates({ 1: item(1), 2: item(2, 'Example', { damageTypes: [2] }),
    3: item(3, 'Unknown', { damageTypes: [900] }), 99: frame })
  assert.deepEqual(result.candidates[0].versions.map((version) => version.damageTypes), [['void'], ['arc']])
  assert.equal(result.candidates[1].versions[0].damageTypes, null)
})

test('explicit overrides resolve fields; Exotic damage still requires review', () => {
  const items = { 1: item(1, 'Example', { inventory: { tierType: 6, isInstanceItem: true, bucketTypeHash: 2465295065 } }), 99: frame }
  const overrides = { weapons: { example: { firstReleaseId: 'base', currentItemHash: '1', versions: {
    1: { releaseId: 'base', source: { category: 'quest', name: 'Example quest' }, champion: { basis: 'exotic-intrinsic', counters: ['barrier'] } },
  } } } }
  assert.equal(buildCandidates(items, {}, overrides).candidates[0].status, 'needs-review')
  overrides.weapons.example.versions[1].damageTypes = ['arc', 'solar', 'void']
  assert.equal(buildCandidates(items, {}, overrides).candidates[0].status, 'reviewed')
  overrides.weapons.example.currentItemHash = '500'
  assert.throws(() => buildCandidates(items, {}, overrides), /Current item/)
})

test('invalid overrides fail instead of producing approved-looking data', () => {
  for (const value of [ { versions: { 1: { champion: { counters: ['fake'], basis: 'frame' } } } },
    { versions: { 1: { damageTypes: ['void', 'void'] } } }, { currentItemHahs: '1' },
    { versions: { 900: { releaseId: 'base' } } } ]) {
    assert.throws(() => buildCandidates({ 1: item(1), 99: frame }, {}, { weapons: { example: value } }))
  }
})

test('new acquisition categories pass importer validation and retain their distinct clues',()=>{
 for(const category of ['season-pass','vendor','tenet-engram','exotic-archive','unreleased']){
  const overrides={weapons:{example:{firstReleaseId:'base',currentItemHash:'1',versions:{1:{releaseId:'base',source:{category,name:'Verified acquisition'},champion:{basis:'frame',counters:['barrier']},damageTypes:['void']}}}}}
  const candidate=buildCandidates({1:item(1),99:frame},{},overrides).candidates[0]
  assert.equal(candidate.status,'reviewed')
  assert.equal(candidate.versions[0].source.category,category)
 }
})

test('trial selection is deterministic and prioritizes curated identities', () => {
  const items = { 1: item(1, 'A'), 2: item(2, 'Z'), 99: frame }
  const curated = [{ id: 'existing-z', name: 'Z', aliases: ['zee'] }]
  const result = buildCandidates(items, {}, { weapons: {} }, 1, curated)
  assert.equal(result.candidates[0].id, 'existing-z')
  assert.deepEqual(result.candidates[0].aliases, ['zee'])
  assert.deepEqual(result, buildCandidates(items, {}, { weapons: {} }, 1, curated))
})


test('unknown override identities and hashes fail even outside the trial limit', () => {
  assert.throws(() => buildCandidates({ 1: item(1), 99: frame }, {}, { weapons: { typo: {} } }), /Unknown weapon/)
  assert.throws(() => buildCandidates({ 1: item(1, 'A'), 2: item(2, 'Z'), 99: frame }, {}, {
    weapons: { z: { currentItemHash: '900' } },
  }, 1), /Current item/)
})
