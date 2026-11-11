import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { runInNewContext } from 'node:vm'

// The logic module has type-only imports, so it can run without a browser or test dependency.
const source = readFileSync(new URL('../src/games/weapons/logic.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } })
const logic = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const read = (name) => JSON.parse(readFileSync(new URL(`../src/data/destiny2/${name}.json`, import.meta.url), 'utf8'))
const pool = read('weapons').filter((weapon) => logic.currentVersion(weapon).champion.counters !== null)
const releases = read('releases')
const find = (id) => pool.find((weapon) => weapon.id === id)

test('correct identity wins; matching attributes alone do not win', () => {
  let round = { answerId: 'cataclysmic', guessIds: [] }
  round = logic.submitGuess(round, 'taipan-4fr', pool)
  assert.equal(logic.roundStatus(round), 'playing')
  round = logic.submitGuess(round, 'cataclysmic', pool)
  assert.equal(logic.roundStatus(round), 'won')
  assert.equal(logic.submitGuess(round, 'wish-ender', pool), round)
})

test('duplicate/unknown guesses cost nothing; all wrong guesses still allow the answer', () => {
  let round = { answerId: 'wish-ender', guessIds: [] }
  round = logic.submitGuess(round, 'ammit-ar2', pool)
  assert.equal(logic.submitGuess(round, 'ammit-ar2', pool), round)
  assert.equal(logic.submitGuess(round, 'unknown', pool), round)
  for (const weapon of pool.filter((weapon) => !['wish-ender', 'ammit-ar2'].includes(weapon.id))) {
    round = logic.submitGuess(round, weapon.id, pool)
  }
  assert.equal(round.guessIds.length, pool.length - 1)
  assert.equal(logic.roundStatus(round), 'playing')
  assert.equal(logic.roundStatus(logic.submitGuess(round, 'wish-ender', pool)), 'won')
})

test('a correct sixth guess wins', () => {
  const guessIds = pool.filter((weapon) => weapon.id !== 'wish-ender').slice(0, 5).map((weapon) => weapon.id)
  assert.equal(logic.roundStatus(logic.submitGuess({ answerId: 'wish-ender', guessIds }, 'wish-ender', pool)), 'won')
})

test('damage compares unordered sets with overlap; Champion requires exact sets', () => {
  assert.equal(logic.compareSets(['arc', 'solar'], ['solar', 'arc']), 'exact')
  assert.equal(logic.compareSets(['arc'], ['solar', 'arc']), 'partial')
  assert.equal(logic.compareSets(['void'], ['solar', 'arc']), 'wrong')
  const guess = structuredClone(find('wish-ender'))
  logic.currentVersion(guess).champion.counters = ['barrier', 'overload']
  assert.equal(logic.evaluateGuess(guess, find('wish-ender'), releases).find((clue) => clue.column === 'champion').match, 'wrong')
})

test('release arrows point toward answer; reissues use current damage and original release', () => {
  const clues = logic.evaluateGuess(find('the-palindrome'), find('final-warning'), releases)
  assert.equal(clues.find((clue) => clue.column === 'release').direction, 'later')
  assert.equal(clues.find((clue) => clue.column === 'release').value, 'S13 · Season of the Chosen (2021)')
  assert.equal(clues.find((clue) => clue.column === 'damage').value, 'Arc')
  const reverse = logic.evaluateGuess(find('final-warning'), find('the-palindrome'), releases)
  assert.equal(reverse.find((clue) => clue.column === 'release').direction, 'earlier')
  assert(logic.evaluateGuess(find('wish-ender'), find('wish-ender'), releases).every((clue) => clue.match === 'exact'))
})

test('search supports aliases and punctuation and excludes previous guesses', () => {
  assert.equal(logic.searchWeapons(pool, 'BXR', [])[0].id, 'bxr-55-battler')
  assert.equal(logic.searchWeapons(pool, "Leviathan's Breath", [])[0].id, 'leviathans-breath')
  assert.equal(logic.searchWeapons(pool, 'BXR', ['bxr-55-battler']).length, 0)
  assert.equal(logic.searchWeapons(pool, 'zzzzz', []).length, 0)
})

test('save restoration accepts valid rounds and rejects corrupt, stale or impossible progress', () => {
  const signature = logic.catalogSignature(pool, releases)
  const round = { answerId: 'wish-ender', guessIds: ['ammit-ar2'] }
  const save = (value, sig = signature) => JSON.stringify({ version: 1, signature: sig, round: value })
  assert.deepEqual(logic.restoreRound(save(round), pool, signature), round)
  for (const raw of [null, '{', 'null', save(round, 'old'), save({ ...round, answerId: 'removed' }),
    save({ ...round, guessIds: ['ammit-ar2', 'ammit-ar2'] }),
    save({ ...round, guessIds: ['wish-ender', 'ammit-ar2'] }),
    save({ ...round, guessIds: [7] }), save({ ...round, guessIds: ['not-in-playable-pool'] })]) {
    assert.equal(logic.restoreRound(raw, pool, signature), null)
  }
  assert.notEqual(logic.catalogSignature(pool.slice(1), releases), signature)
})

test('answer selection uses the pool and reaches both ends', () => {
  const answers=pool.filter(logic.canBeAnswer)
  assert.equal(logic.createRound(pool, () => 0).answerId, answers[0].id)
  assert.equal(logic.createRound(pool, () => 0.999999).answerId, answers.at(-1).id)
})

test('unreleased discoveries can be searched, guessed and restored but never selected as answers',()=>{
 const discovery=find('bushwhacker'),answer=find('wish-ender')
 assert(discovery)
 assert.equal(logic.currentVersion(discovery).source.category,'unreleased')
 assert.equal(logic.canBeAnswer(discovery),false)
 assert(logic.searchWeapons(pool,'bushwhacker',[]).some((w)=>w.id===discovery.id))
 const mixed=[discovery,answer,discovery]
 for(const random of [0,0.25,0.5,0.999999,1])assert.equal(logic.createRound(mixed,()=>random).answerId,answer.id)
 assert.throws(()=>logic.createRound([discovery]))
 const round=logic.submitGuess({answerId:answer.id,guessIds:[]},discovery.id,pool)
 assert.deepEqual(round.guessIds,[discovery.id])
 const signature=logic.catalogSignature(pool,releases)
 const save=(round)=>JSON.stringify({version:1,signature,round})
 assert.deepEqual(logic.restoreRound(save(round),pool,signature),round)
 assert.equal(logic.restoreRound(save({answerId:discovery.id,guessIds:[]}),pool,signature),null)
 assert.deepEqual(logic.evaluateGuess(discovery,answer,releases).find(c=>c.column==='release'),{column:'release',value:'Unreleased',match:'wrong'})
})

test('long rounds restore and stored chronology is preserved', () => {
  const round = { answerId: 'wish-ender', guessIds: pool.filter((w) => w.id !== 'wish-ender').map((w) => w.id) }
  const signature = logic.catalogSignature(pool, releases)
  assert.deepEqual(logic.restoreRound(JSON.stringify({ version: 1, signature, round }), pool, signature), round)
  assert.equal(logic.roundStatus(round), 'playing')
})


test('weapon thumbnails exist locally and have valid JPEG headers', () => {
  for (const weapon of read('weapons')) {
    assert(weapon.icon, `Missing image path: ${weapon.name}`)
    const bytes = readFileSync(new URL(`../public/${weapon.icon}`, import.meta.url))
    assert.equal(bytes.readUInt16BE(0), 0xffd8, `Invalid JPEG: ${weapon.name}`)
  }
})

test('adding presentation icons does not invalidate an existing saved round', () => {
  const withoutIcons = pool.map(({ icon, ...weapon }) => weapon)
  assert.equal(logic.catalogSignature(pool, releases), logic.catalogSignature(withoutIcons, releases))
})


test('different releases in the same calendar year are partial and keep direction', () => {
  const releaseClue = (guess, answer) => logic.evaluateGuess(find(guess), find(answer), releases).find((clue) => clue.column === 'release')
  const sameYear = releaseClue('ammit-ar2', 'riptide')
  assert.equal(sameYear.match, 'partial')
  assert.equal(sameYear.direction, 'earlier')
  assert.equal(releaseClue('riptide', 'ammit-ar2').direction, 'later')
  assert.equal(releaseClue('wish-ender', 'final-warning').match, 'wrong')
  assert.equal(releaseClue('ammit-ar2', 'taipan-4fr').match, 'exact')
  assert.equal(releaseClue('ammit-ar2', 'taipan-4fr').direction, undefined)
})


test('category dialog stays open through the StrictMode effect replay', () => {
  const source = readFileSync(new URL('../src/games/weapons/CategoryHelp.tsx', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } })
  let effect
  let closeCalls = 0
  let openCalls = 0
  let dismissals = 0
  const element = {
    open: false,
    scrollTop: 50,
    showModal() { this.open = true; openCalls++ },
    close() { this.open = false; closeCalls++ },
    querySelector() { return { focus() {} } },
  }
  const body = { style: { overflow: 'auto' } }
  const exports = {}
  runInNewContext(outputText, {
    exports, document: { body },
    require(name) {
      if (name === 'react') return { useRef: () => ({ current: element }), useEffect: (setup) => { effect = setup } }
      if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
      throw new Error(`Unexpected import: ${name}`)
    },
  })
  const tree = exports.default({ category: 'ammo', onClose: () => { dismissals++ } })
  const firstCleanup = effect()
  firstCleanup()
  const finalCleanup = effect()
  assert.equal(element.open, true)
  assert.equal(openCalls, 1)
  assert.equal(closeCalls, 0, 'Effect cleanup must not queue a close event')
  assert.equal(element.scrollTop, 0)
  assert.equal(body.style.overflow, 'hidden')
  assert(JSON.stringify(tree).includes('Ammo type'))
  assert(JSON.stringify(tree).includes('Primary, Special, or Heavy'))
  tree.props.onClose()
  assert.equal(dismissals, 1, 'User dismissal still notifies the parent')
  finalCleanup()
  assert.equal(body.style.overflow, 'auto')
})

test('playable gate rejects incomplete clues, missing images and broken release references', async () => {
  const source = readFileSync(new URL('../src/data/weapon-readiness.ts', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } })
  const { weaponReadinessIssues } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
  const good = structuredClone(find('ammit-ar2'))
  assert.deepEqual(weaponReadinessIssues(good, releases), [])
  for (const mutate of [
    (weapon) => { delete weapon.icon },
    (weapon) => { weapon.icon = '../outside.jpg' },
    (weapon) => { weapon.firstReleaseId = 'unknown' },
    (weapon) => { weapon.currentVersionId = 'missing' },
    (weapon) => { logic.currentVersion(weapon).damageTypes = [] },
    (weapon) => { logic.currentVersion(weapon).source.name = '' },
    (weapon) => { logic.currentVersion(weapon).champion.counters = null },
  ]) {
    const bad = structuredClone(good)
    mutate(bad)
    assert(weaponReadinessIssues(bad, releases).length > 0)
  }
})


test('share summary contains all eight clues per guess, oldest first, without spoilers', () => {
  const round = { answerId: 'ammit-ar2', guessIds: ['wish-ender', 'riptide', 'ammit-ar2'] }
  const grid = logic.buildGuessGrid(round, pool, releases)
  assert.equal(grid.length, 3)
  assert(grid.every((row) => row.length === 8))
  assert.equal(grid[1].at(-1).match, 'partial')
  const share = logic.buildShareText(round, pool, releases)
  const lines = share.split('\n')
  assert(lines[0].includes('Practice · 3 guesses'))
  assert.equal(lines[3], '🟩'.repeat(8))
  assert(!share.includes('Ammit'))
  assert(!share.includes('Wish-Ender'))
  assert.equal(logic.buildShareText({ ...round, guessIds: ['wish-ender'] }, pool, releases), '')
})

test('season display preserves exact release matching and saved rounds', () => {
  assert.equal(logic.formatRelease(releases.find((r) => r.id === 'forsaken')), 'S4 · Forsaken / Season of the Outlaw (2018)')
  const plain = releases.map(({ seasonNumber, ...release }) => release)
  assert.equal(logic.catalogSignature(pool, releases), logic.catalogSignature(pool, plain))
})


test('user-confirmed weapon corrections are reflected in playable clues', () => {
  assert.deepEqual(logic.currentVersion(find('hard-light')).champion.counters, ['overload'])
  assert.equal(find('a-good-shout').firstReleaseId, 'renegades')
  assert.equal(logic.currentVersion(find('a-good-shout')).source.name, 'Zavala weapon set')
  assert.equal(logic.currentVersion(find('a-sudden-death')).source.name, 'Prophecy')
  assert.equal(logic.currentVersion(find('adamantite')).source.name, 'Pit of Heresy')
  assert.equal(logic.currentVersion(find('adored')).source.name, 'Pinnacle Ops')
})
