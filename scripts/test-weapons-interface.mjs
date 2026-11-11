import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'

const read=(name)=>JSON.parse(readFileSync(new URL(`../src/data/destiny2/${name}.json`,import.meta.url),'utf8'))
const pool=read('weapons'),releases=read('releases')
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
 const modules={react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'../../data/destiny2':{playableWeapons:pool,releases},'./assets':{assetUrl:(path)=>path},'./weapons.css':{},'./ClueIcons':{default:()=>null},'./CategoryHelp':{default:()=>null}}
 for(const [module,file]of [['./logic','logic.ts'],['./daily','daily.ts'],['./WinSummary','WinSummary.tsx'],['Weapons','Weapons.tsx']]){
  const source=readFileSync(new URL(`../src/games/weapons/${file}`,import.meta.url),'utf8').replaceAll('import.meta.env.DEV','__development').replaceAll('import.meta.hot','__hot')
  const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}})
  const exports={}
  runInNewContext(outputText,{exports,__development:development,__hot:development?hot:undefined,Math:math,Date,Intl,queueMicrotask,sessionStorage:{getItem:(key)=>session.get(key)??null,setItem:(key,value)=>session.set(key,value)},localStorage:{getItem:(key)=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},document:{addEventListener(){},removeEventListener(){}},window:{setInterval:()=>1,clearInterval(){},addEventListener(){},removeEventListener(){}},require:(name)=>{if(!(name in modules))throw new Error(`Unexpected import ${name}`);return modules[name]}})
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
const roundNode=(tree)=>nodes(tree,(node)=>node.type?.name==='WeaponRound')[0]

test('Enter submits the top search result when several weapons match',()=>{
 const h=harness(true),round=h.instance()
 const parent=h.render(h.instance(),h.modules.Weapons.default,{mode:'practice'}),game=roundNode(parent)
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
 const view=h.render(parent,h.modules.Weapons.default,{mode:'practice'}),game=roundNode(view)
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
 assert.equal(nodes(tree,(node)=>node.props?.id==='weapon-suggestions').length,0)
 assert.equal(nodes(tree,(node)=>node.type==='caption')[0].props.children[1],1)
 assert.equal(nodes(tree,(node)=>node.type==='table').length,1)
 assert.equal(nodes(tree,(node)=>node.props?.className==='weapon-rules').length,1)
 assert.equal(nodes(tree,(node)=>node.type==='h2')[0].props.children.join(''),'Identified in 1')
 const summary=nodes(tree,(node)=>node.type?.name==='WinSummary')[0]
 const result=h.render(h.instance(),summary.type,summary.props)
 assert.equal(nodes(result,(node)=>node.type==='h2')[0].props.children,'Share your run')
 assert.equal(nodes(result,(node)=>node.props?.className==='summary-square square-exact').length,8)
 assert.equal(nodes(result,(node)=>node.props?.className==='result-share-card').length,0)
 assert.equal(nodes(result,(node)=>node.props?.className==='summary-guess-number').length,1)
 assert.equal(nodes(result,(node)=>node.type==='button')[0].props.children,'Share result')
})

test('development clears saved wins and remounts on edits; release mode restores saved progress',()=>{
 for(const development of [true,false])for(const mode of ['practice','daily']){
  const h=harness(development),logic=h.modules['./logic'],daily=h.modules['./daily']
  const dayKey=daily.dailyDate()
  const round=mode==='daily'?daily.createDailyRound(dayKey,pool):logic.createRound(pool,()=>0),won=logic.submitGuess(round,round.answerId,pool)
  const raw=JSON.stringify({version:1,signature:logic.catalogSignature(pool,releases),round:won,...(mode==='daily'?{dayKey}:{})})
  const key=mode==='daily'?daily.dailyStorageKey(dayKey):daily.PRACTICE_STORAGE_KEY
  h.storage.set(key,raw)
  const state=h.instance(),parent=h.render(state,h.modules.Weapons.default,{mode}),game=roundNode(parent)
  assert(!JSON.stringify(parent).includes('Europe/Zurich'))
  const tree=h.render(h.instance(),game.type,game.props)
  assert.equal(nodes(tree,(node)=>node.type==='form').length,development?1:0)
  assert.equal(nodes(tree,(node)=>node.type?.name==='WinSummary').length,development?0:1)
  if(development){
   assert.equal(h.storage.get(key),raw,'Development must not overwrite release saves')
   h.events.get('destinydoku:reset-weapons')()
   const next=h.render(state,h.modules.Weapons.default,{mode})
   assert.notEqual(roundNode(next).key,game.key)
   assert.notEqual(roundNode(next).props.developmentAnswerId,game.props.developmentAnswerId)
   if(mode==='daily'){
    const reloaded=harness(true,h.session)
    const reloadView=reloaded.render(reloaded.instance(),reloaded.modules.Weapons.default,{mode})
    assert.notEqual(roundNode(reloadView).props.developmentAnswerId,roundNode(next).props.developmentAnswerId)
   }
  }
 }
})
