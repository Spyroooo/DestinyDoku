import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const root = new URL('../', import.meta.url)
const { characters } = JSON.parse(readFileSync(new URL('src/data/destiny2/characters.json', root), 'utf8'))
function assetHelper(base = '/') {
  const source = readFileSync(new URL('src/games/weapons/assets.ts', root), 'utf8').replaceAll('import.meta.env.BASE_URL', JSON.stringify(base))
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
  const exports = {}
  runInNewContext(outputText, { exports })
  return exports.assetUrl
}
function iconRenderer() {
  const source = readFileSync(new URL('src/games/characters/ClueIcons.tsx', root), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  const jsx = (type, props) => typeof type === 'function' ? type(props) : { type, props }
  const exports = {}
  runInNewContext(outputText, { exports, require: name => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    if (name === '../weapons/assets') return { assetUrl: assetHelper() }
    throw new Error(`Unexpected import: ${name}`)
  } })
  return exports.default
}
function images(node) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(images)
  return [...(node.type === 'img' ? [node.props.src] : []), ...images(node.props?.children)]
}

test('absolute and relative asset paths stay on the site origin at root and nested Vite bases', () => {
  for (const base of ['/', '/DestinyDoku/']) {
    const assetUrl = assetHelper(base)
    for (const path of ['images/categories/ghost.svg', '/images/characters/cayde-6.jpg']) {
      const resolved = new URL(assetUrl(path), 'https://destinydoku.example/characters/daily')
      assert.equal(resolved.origin, 'https://destinydoku.example', 'A leading slash must not become a protocol-relative hostname')
      assert.equal(resolved.pathname, base + path.replace(/^\/+/, ''))
    }
  }
})

test('all 82 portrait URLs resolve to local images, without a second-host request', () => {
  const assetUrl = assetHelper()
  for (const character of characters) {
    const url = new URL(assetUrl(character.icon), 'https://destinydoku.example/characters')
    assert.equal(url.origin, 'https://destinydoku.example', character.name)
    const image = readFileSync(new URL(`public${url.pathname}`, root))
    assert.equal(image.readUInt16BE(), 0xffd8, character.name)
  }
})

test('Hunter, Titan and Warlock use their distinct class emblems', () => {
  const render = iconRenderer()
  for (const [guardianClass, filename] of [['Hunter', 'class_hunter_proportional.svg'], ['Titan', 'class_titan_proportional.svg'], ['Warlock', 'class_warlock_proportional.svg']]) {
    const character = characters.find(entry => entry.guardianClass === guardianClass)
    assert.equal(images(render({ column: 'guardianClass', character }))[0], `/images/characters/symbols/${filename}`)
  }
})

test('every image-backed clue icon exists locally and contains SVG artwork', () => {
  const render = iconRenderer(), used = new Set()
  for (const character of characters) {
    for (const column of ['species', 'gender', 'guardianClass', 'affiliations', 'roles', 'debutGame', 'release']) {
      for (const path of images(render({ column, character }))) {
        assert(path.startsWith('/images/'), path)
        assert(!path.startsWith('//'), path)
        assert(readFileSync(new URL(`public${path}`, root), 'utf8').includes('<svg'), path)
        used.add(path)
      }
    }
  }
  assert(used.size > 10, 'Clues should use a selection of real Destiny emblems')
})
