import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'

const {characters:pool,releases}=JSON.parse(readFileSync(new URL('../src/data/destiny2/characters.json',import.meta.url),'utf8'))
function harness(development,session=new Map()){
 let active
 const events=new Map(),storage=new Map()
 const react={
  memo:(component)=>component,
  useCallback:(callback)=>callback,
  useMemo:(factory)=>factory(),
  useState(initial){const instance=active,index=instance.cursor++;if(!instance.slots[index])instance.slots[index]={value:typeof initial==='function'?initial():initial};return [instance.slots[index].value,(value)=>{instance.slots[index].value=typeof value==='function'?value(instance.slots[index].value):value}]},
  useRef(initial){const index=active.cursor++;return (active.slots[index]??={current:initial})},
  useEffect(setup,deps){const index=active.cursor++,old=active.slots[index];if(!old||deps.some((value,i)=>value!==old.deps[i])){active.slots[index]={deps,cleanup:old?.cleanup};active.effects.push(()=>{old?.cleanup?.();active.slots[index].cleanup=setup()})}},
 }
 const jsx=(type,props,key)=>({type,props,key})
 const hot={on:(name,callback)=>events.set(name,callback),off:(name)=>events.delete(name)}
 const math=Object.create(Math);math.random=()=>0
 const modules={react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'./data':{characters:pool,releases},'../weapons/assets':{assetUrl:(path)=>path},'../weapons/weapons.css':{},'./characters.css':{},'./ClueIcons':{default:()=>null},'./CategoryHelp':{default:()=>null},'../weapons/DailyCounter':{default:()=>null}}
 for(const [key,file] of [['../weapons/logic','logic.ts'],['../weapons/daily','daily.ts']]) {
  const {outputText}=ts.transpileModule(readFileSync(new URL(`../src/games/weapons/${file}`,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.CommonJS}})
  const exports={};runInNewContext(outputText,{exports,crypto,require:()=>modules['../weapons/logic']});modules[key]=exports
 }
 for(const [module,file]of [['./logic','logic.ts'],['./daily','daily.ts'],['./WinSummary','WinSummary.tsx'],['Characters','Characters.tsx']]){
  const source=readFileSync(new URL(`../src/games/characters/${file}`,import.meta.url),'utf8').replaceAll('import.meta.env.DEV','__development').replaceAll('import.meta.hot','__hot')
  const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}})
  const exports={}
  runInNewContext(outputText,{exports,__development:development,__hot:development?hot:undefined,Math:math,Date,Intl,crypto,queueMicrotask,sessionStorage:{getItem:(key)=>session.get(key)??null,setItem:(key,value)=>session.set(key,value)},localStorage:{getItem:(key)=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},document:{addEventListener(){},removeEventListener(){}},window:{setInterval:()=>1,clearInterval(){},addEventListener(){},removeEventListener(){}},require:(name)=>{if(!(name in modules))throw new Error(`Unexpected import ${name}`);return modules[name]}})
  modules[module]=exports
 }
 const instance=()=>({slots:[],cursor:0,effects:[]})
 const render=(state,component,props)=>{active=state;state.cursor=0;state.effects=[];const tree=component(props);for(const setup of state.effects)setup();return tree}
 return {modules,events,storage,session,instance,render}
}
function nodes(tree,predicate){
 if(!tree||typeof tree!=='object')return []
 if(Array.isArray(tree))return tree.flatMap((child)=>nodes(child,predicate))
 return [...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)]
}
const input=(tree)=>nodes(tree,(node)=>node.type==='input')[0]
const roundNode=(tree)=>nodes(tree,(node)=>node.type?.name==='CharacterRound')[0]

test('Enter submits the top search result when several characters match',()=>{
 const h=harness(true),round=h.instance()
 const parent=h.render(h.instance(),h.modules.Characters.default,{mode:'practice'}),game=roundNode(parent)
 let tree=h.render(round,game.type,game.props)
 input(tree).props.onChange({target:{value:'a'}})
 tree=h.render(round,game.type,game.props)
 const choices=nodes(tree,(node)=>node.props?.className==='weapon-suggestion')
 assert(choices.length>1)
 const expected=choices[0].props['aria-label'].slice('Guess '.length)
 nodes(tree,(node)=>node.type==='form')[0].props.onSubmit({preventDefault(){}})
 tree=h.render(round,game.type,game.props)
 assert.equal(nodes(tree,(node)=>node.type==='caption')[0].props.children[1],1)
 assert.equal(nodes(tree,(node)=>node.props?.className==='weapon-portrait')[0].props['aria-label'],`Guess 1: ${expected}`)
})

test('clicking a search result submits the guess immediately and retains the history and share layout',()=>{
 const h=harness(true),parent=h.instance(),round=h.instance()
 const view=h.render(parent,h.modules.Characters.default,{mode:'practice'}),game=roundNode(view)
 let tree=h.render(round,game.type,game.props)
 const expected=h.modules['./logic'].createRound(pool,()=>0).answerId,weapon=pool.find((w)=>w.id===expected)
 input(tree).props.onChange({target:{value:weapon.name.slice(0,4)}})
 tree=h.render(round,game.type,game.props)
 const choice=nodes(tree,(node)=>node.props?.['aria-label']===`Guess ${weapon.name}`)[0]
 assert(choice)
 let prevented=false
 choice.props.onMouseDown({preventDefault(){prevented=true}})
 assert(prevented,'Keep input focus so Safari does not close the dropdown before click')
 choice.props.onClick()
 tree=h.render(round,game.type,game.props)
 assert.equal(nodes(tree,(node)=>node.props?.id==='character-suggestions').length,0)
 assert.equal(nodes(tree,(node)=>node.type==='caption')[0].props.children[1],1)
 assert.equal(nodes(tree,(node)=>node.type==='table').length,1)
 assert.equal(nodes(tree,(node)=>node.props?.className==='weapon-rules').length,1)
 assert.equal(nodes(tree,(node)=>node.type==='h2')[0].props.children.join(''),'Identified in 1')
 const completedCounter=nodes(tree,(node)=>node.props?.mode==='practice'&&node.props?.completed===true)[0]
 assert(completedCounter.props.runId)
 assert(Number.isFinite(Date.parse(completedCounter.props.completedAt)))
 const summary=nodes(tree,(node)=>node.type?.name==='WinSummary')[0]
 const result=h.render(h.instance(),summary.type,summary.props)
 assert.equal(nodes(result,(node)=>node.type==='h2')[0].props.children,'Share your run')
 assert.equal(nodes(result,(node)=>node.props?.className==='summary-square square-exact').length,7)
 assert.equal(nodes(result,(node)=>node.props?.className==='result-share-card').length,0)
 assert.equal(nodes(result,(node)=>node.props?.className==='summary-guess-number').length,1)
 assert.equal(nodes(result,(node)=>node.type==='button')[0].props.children,'Share result')
})

test('optional hints appear after a guess, unlock at 3 and 5 misses, and persist in both modes',()=>{
 for(const mode of ['practice','daily']){
  const h=harness(false),logic=h.modules['./logic'],daily=h.modules['./daily']
  const dayKey=daily.dailyDate(),initial=mode==='daily'?daily.createDailyRound(dayKey,pool):logic.createRound(pool,()=>0)
  const key=mode==='daily'?daily.dailyStorageKey(dayKey):daily.PRACTICE_STORAGE_KEY
  h.storage.set(key,JSON.stringify({version:1,signature:logic.catalogSignature(pool,releases),round:initial,...(mode==='daily'?{dayKey}:{})}))
  const parent=h.render(h.instance(),h.modules.Characters.default,{mode}),game=roundNode(parent)
  const state=h.instance()
  let tree=h.render(state,game.type,game.props)
  const hintButtons=()=>nodes(tree,(node)=>node.props?.['aria-label']?.startsWith('Reveal '))
  const guess=(weapon)=>{
   input(tree).props.onChange({target:{value:weapon.name}})
   tree=h.render(state,game.type,game.props)
   nodes(tree,(node)=>node.type==='form')[0].props.onSubmit({preventDefault(){}})
   tree=h.render(state,game.type,game.props)
  }
  assert.equal(nodes(tree,(node)=>node.props?.className==='weapon-hints').length,0)
  const wrong=pool.filter((weapon)=>weapon.id!==initial.answerId).slice(0,5)
  for(let i=0;i<wrong.length;i++){
   guess(wrong[i])
   assert.equal(hintButtons()[0].props.disabled,i+1<3)
   assert.equal(hintButtons()[1]?.props.disabled ?? hintButtons()[0].props.disabled,i+1<5)
   if(i===0){
    hintButtons()[0].props.onClick()
    tree=h.render(state,game.type,game.props)
    assert.equal(nodes(tree,(node)=>node.props?.className==='hint-value').length,0)
   }
  }
  // Unlocked does not automatically disclose either answer.
  assert.equal(nodes(tree,(node)=>node.props?.className==='hint-value').length,0)
  for(const button of hintButtons())button.props.onClick()
  tree=h.render(state,game.type,game.props)
  const answer=pool.find((weapon)=>weapon.id===initial.answerId)
  const values=nodes(tree,(node)=>node.props?.className==='hint-value').map((node)=>node.props.children)
  assert.equal(values[0],answer.name.match(/[\p{L}\p{N}]/u)?.[0].toLocaleUpperCase() ?? answer.name.charAt(0))
  assert.equal(values[1],logic.formatRelease(releases.find((release)=>release.id===answer.firstReleaseId)))
  const restored=h.render(h.instance(),game.type,game.props)
  assert.equal(nodes(restored,(node)=>node.props?.className==='hint-value').length,2)
  guess(answer)
  const saved=JSON.parse(h.storage.get(key)).round
  assert.equal(logic.buildShareText(saved,pool,releases).includes('Hints used: 2/2'),true)
  if(mode==='practice'){
   nodes(tree,(node)=>node.type==='button'&&node.props.children==='Play again')[0].props.onClick()
   tree=h.render(state,game.type,game.props)
   assert.equal(nodes(tree,(node)=>node.props?.className==='weapon-hints').length,0)
  }
 }
})

test('development clears saved wins and remounts on edits; release mode restores saved progress',()=>{
 for(const development of [true,false])for(const mode of ['practice','daily']){
  const h=harness(development),logic=h.modules['./logic'],daily=h.modules['./daily']
  const dayKey=daily.dailyDate()
  const round=mode==='daily'?daily.createDailyRound(dayKey,pool):logic.createRound(pool,()=>0),won=logic.submitGuess(round,round.answerId,pool)
  const raw=JSON.stringify({version:1,signature:logic.catalogSignature(pool,releases),round:won,...(mode==='daily'?{dayKey}:{})})
  const key=mode==='daily'?daily.dailyStorageKey(dayKey):daily.PRACTICE_STORAGE_KEY
  h.storage.set(key,raw)
  const state=h.instance(),parent=h.render(state,h.modules.Characters.default,{mode}),game=roundNode(parent)
  assert(!JSON.stringify(parent).includes('Europe/Zurich'))
  const tree=h.render(h.instance(),game.type,game.props)
  assert.equal(nodes(tree,(node)=>node.type==='form').length,development?1:0)
  assert.equal(nodes(tree,(node)=>node.type?.name==='WinSummary').length,development?0:1)
  if(development){
   assert.equal(h.storage.get(key),raw,'Development must not overwrite release saves')
   h.events.get('destinydoku:reset-characters')()
   const next=h.render(state,h.modules.Characters.default,{mode})
   assert.notEqual(roundNode(next).key,game.key)
   assert.notEqual(roundNode(next).props.developmentAnswerId,game.props.developmentAnswerId)
   if(mode==='daily'){
    const reloaded=harness(true,h.session)
    const reloadView=reloaded.render(reloaded.instance(),reloaded.modules.Characters.default,{mode})
    assert.notEqual(roundNode(reloadView).props.developmentAnswerId,roundNode(next).props.developmentAnswerId)
   }
  }
 }
})

test('character clues preserve approved values, compare sets and never falsely match missing information',()=>{
 const logic=harness(false).modules['./logic']
 const find=(name)=>pool.find((character)=>character.name===name)
 const witness=find('The Witness'),riven=find('Riven'),eramis=find('Eramis')
 const clues=logic.evaluateGuess(riven,eramis,releases)
 assert.equal(clues.find((clue)=>clue.column==='affiliations').match,'unknown')
 assert.equal(logic.evaluateGuess(find('Cayde-6'),witness,releases).find((clue)=>clue.column==='gender').match,'unknown')
 assert(logic.evaluateGuess(witness,witness,releases).every((clue)=>clue.match==='exact'))
 const partial=logic.evaluateGuess({...riven,roles:['Leader','Boss']},{...eramis,roles:['Boss']},releases)
 assert.equal(partial.find((clue)=>clue.column==='roles').match,'partial')
 const sameYear=logic.evaluateGuess(find('Saint-14'),find('The Witness'),releases).at(-1)
 assert.equal(sameYear.match,'wrong')
 assert.equal(sameYear.direction,'later')
 const g={...riven,firstReleaseId:'forge'},a={...eramis,firstReleaseId:'forsaken'}
 const release=logic.evaluateGuess(g,a,releases).at(-1)
 assert.equal(release.match,'partial')
 assert.equal(release.direction,'earlier')
 assert.equal(find('Clovis Bray’s Exo AI').species,'Exo')
 assert.equal(find('Nezarec').species,'Tormentor')
 assert.equal(find('Luzaku').guardianClass,'Hive Lightbearer')
 assert.equal(find('Starhorse').firstReleaseId,'anniversary')
 assert.equal(find('Crota, Son of Oryx').firstReleaseId,'witch')
})

test('character search supports accents, aliases, optional The and relevance without unordered letter matching',()=>{
 const logic=harness(false).modules['./logic']
 for(const [query,name] of [['xur','Xûr'],['savathun','Savathûn'],['uldren','Crow / Uldren Sov'],['stranger','Elsie Bray / The Exo Stranger'],['drifter','The Drifter'],['zav','Commander Zavala']]) {
  assert.equal(logic.searchCharacters(pool,query,[])[0]?.name,name)
 }
 assert.equal(logic.searchCharacters(pool,'zzq',[]).length,0)
 assert.equal(logic.searchCharacters(pool,'cya',[]).length,0)
 assert.equal(logic.searchCharacters(pool,'',[]).length,0)
 assert.equal(logic.searchCharacters(pool,'xur',[pool.find((c)=>c.name==='Xûr').id]).length,0)
})

test('character daily answers are stable, saves reject corrupt progress, and share text has no spoilers',()=>{
 const h=harness(false),logic=h.modules['./logic'],daily=h.modules['./daily'],day='2026-11-18'
 const first=daily.createDailyRound(day,pool),reordered=daily.createDailyRound(day,[...pool].reverse())
 assert.equal(first.answerId,reordered.answerId)
 const signature=logic.catalogSignature(pool,releases)
 const wrong=pool.find((c)=>c.id!==first.answerId),answer=pool.find((c)=>c.id===first.answerId)
 let round=logic.submitGuess(first,wrong.id,pool)
 assert.equal(logic.submitGuess(round,wrong.id,pool),round)
 assert.equal(logic.submitGuess(round,'not-a-character',pool),round)
 round=logic.submitGuess(round,answer.id,pool)
 const raw=JSON.stringify({version:1,signature,dayKey:day,round})
 assert(daily.restoreDailyRound(raw,pool,signature,day))
 assert.equal(daily.restoreDailyRound(raw,pool,signature,'2026-11-19'),null)
 assert.equal(logic.restoreRound(raw,pool,'stale'),null)
 assert.equal(logic.restoreRound(JSON.stringify({version:1,signature,round:{...round,guessIds:[answer.id,wrong.id]}}),pool,signature),null)
 const text=logic.buildShareText(round,pool,releases,{mode:'daily',dayKey:day})
 assert(text.includes('https://destinydoku.com/characters/daily'))
 assert(!text.includes(answer.name))
 assert.equal(text.split('\n')[2],'🟩'.repeat(7))
 const alternative=daily.createDevelopmentDailyRound(pool,first.answerId,()=>0)
 assert.notEqual(alternative.answerId,first.answerId)
 assert.notEqual(daily.PRACTICE_STORAGE_KEY,'destinydoku:weapons:practice:v1')
})

test('all 82 characters have local JPEG portraits and valid introductions',()=>{
 assert.equal(pool.length,82)
 for(const character of pool){
  const image=readFileSync(new URL(`../public${character.icon}`,import.meta.url))
  assert.equal(image[0],0xff,character.name)
  assert.equal(image[1],0xd8,character.name)
  assert(releases.some((release)=>release.id===character.firstReleaseId))
 }
})


test('category dialogs focus their invoking button before opening, including Safari pointer clicks',()=>{
 const h=harness(true),parent=h.render(h.instance(),h.modules.Characters.default,{mode:'practice'}),game=roundNode(parent)
 const state=h.instance()
 let tree=h.render(state,game.type,game.props)
 const buttons=nodes(tree,(node)=>node.props?.className==='category-heading')
 for(const button of buttons){
  let focused=false
  const trigger={focus(options){focused=true;assert.equal(options.preventScroll,true)}}
  button.props.onClick({currentTarget:trigger})
  assert(focused,'The native dialog must remember this button rather than the scrollable table')
  tree=h.render(state,game.type,game.props)
  const dialog=nodes(tree,(node)=>typeof node.props?.onClose==='function')[0]
  assert(dialog,'Click still opens category help')
  dialog.props.onClose()
  tree=h.render(state,game.type,game.props)
  assert.equal(nodes(tree,(node)=>typeof node.props?.onClose==='function').length,0)
 }
})

test('expanded roster keeps distinct identities, agreed introduction rules and safe unknown values',()=>{
 const logic=harness(false).modules['./logic']
 const expected=[
  ['Consul','The Consul','red-war'],['Taniks Reborn','Taniks','beyond-light'],
  ['IX','The Nine','drifter'],['Maya Sunderesh','Maya Sundaresh / The Conductor','echoes'],
  ['Lakshimi-2','Lakshmi-2','red-war'],['Atheon','Atheon','splicer'],['Traveller','The Traveler','red-war'],
 ]
 for(const [query,name,release] of expected){
  const character=logic.searchCharacters(pool,query,[])[0]
  assert.equal(character?.name,name)
  assert.equal(character.firstReleaseId,release)
 }
 const nine=pool.find((c)=>c.name==='The Nine'),atheon=pool.find((c)=>c.name==='Atheon'),traveler=pool.find((c)=>c.name==='The Traveler')
 for(const character of [nine,atheon,traveler])assert.equal(character.gender,'Not applicable')
 assert.equal(logic.evaluateGuess(nine,traveler,releases).find((c)=>c.column==='gender').match,'exact')
 assert.equal(pool.filter((c)=>c.aliases.some((name)=>name.includes('Taniks'))).length,1)
 assert.notEqual(pool.find((c)=>c.name.startsWith('Maya')).id,pool.find((c)=>c.name==='Lakshmi-2').id)
})

test('all approved raid final bosses are playable with portraits, aliases and original raid releases',()=>{
 const logic=harness(false).modules['./logic']
 for(const [query,id,release] of [
  ['Argos','argos','osiris'],['Val Cauor','val-cauor','warmind'],
  ['Insurrection Prime','insurrection-prime','forge'],['Gahlran','gahlran','opulence'],
  ['Sanctified Mind','sanctified-mind','undying'],['Koregos Fractured in Time','koregos','edge-of-fate'],
 ]){
  const character=logic.searchCharacters(pool,query,[])[0]
  assert.equal(character?.id,id)
  assert.equal(character.firstReleaseId,release)
  assert(character.roles.includes('Boss'))
  const round=logic.submitGuess({answerId:id,guessIds:[]},id,pool)
  assert.equal(logic.roundStatus(round),'won')
  assert(logic.evaluateGuess(character,character,releases).every((clue)=>clue.match==='exact'))
 }
 assert(!pool.some((character)=>character.name.includes('Aksis')),'Destiny 1-only candidate stays excluded')
})

test('reviewed raid choices and Tower NPC identities are reflected in the playable roster',()=>{
 const logic=harness(false).modules['./logic'],find=(id)=>pool.find((character)=>character.id===id)
 assert.equal(find('insurrection-prime').species,'Servitor/Brig')
 assert.equal(find('atheon').affiliations,null)
 assert.equal(find('val-cauor').species,'Cabal')
 assert.equal(find('val-cauor').affiliations.join(','),'Red Legion')
 assert.equal(find('gahlran').affiliations.join(','),"Savathûn's Brood")
 assert.equal(find('the-nine').species,'Dark matter entities')
 assert.equal(find('the-nine').firstReleaseId,'drifter')
 for(const id of ['atheon','argos','sanctified-mind','koregos','insurrection-prime','the-nine','the-traveler'])assert.equal(find(id).gender,'Not applicable')
 assert.equal(logic.searchCharacters(pool,'Postmaster',[])[0].id,'kadi-55-30')
 assert.equal(logic.searchCharacters(pool,'Sweeper Bot',[])[0].id,'benedict-99-40')
 assert.equal(logic.searchCharacters(pool,'Cleaning Bot',[])[0].id,'benedict-99-40')
 for(const id of ['kadi-55-30','benedict-99-40']){
  assert.equal(find(id).species,'Frame')
  assert.equal(find(id).guardianClass,'None')
  assert.equal(find(id).firstReleaseId,'red-war')
 }
 assert.equal(find('kadi-55-30').debutGame,'destiny1')
 assert.equal(find('benedict-99-40').debutGame,'destiny2')
 const research=JSON.parse(readFileSync(new URL('../data/character-research/candidates.json',import.meta.url),'utf8'))
 assert(research.characters.every((character)=>Object.values(character.fields).every((field)=>!field.reviewRequired)))
})
