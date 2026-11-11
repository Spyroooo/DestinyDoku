import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { catalogTypeDiagnostics } from './lib/catalog-type-check.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = (name) => JSON.parse(readFileSync(new URL(`../src/data/destiny2/${name}.json`, import.meta.url), 'utf8'))

test('large catalogues still check every entry and reject invalid nested fields', () => {
  const weapons = read('weapons'), releases = read('releases')
  const large = Array.from({length: Math.max(1500, weapons.length)}, (_, index) => ({
    ...structuredClone(weapons[index % weapons.length]), id: `test-${index}`, name: `Test ${index}`,
  }))
  assert.deepEqual(catalogTypeDiagnostics(large, releases, root), [])
  large.at(-1).versions.at(-1).weaponType = 'invalid-weapon-type'
  const diagnostics = catalogTypeDiagnostics(large, releases, root)
  assert(diagnostics.some((diagnostic) => diagnostic.code === 2322))
  assert(!diagnostics.some((diagnostic) => diagnostic.code === 2590))
})
