import test from 'node:test'
import assert from 'node:assert/strict'
import { legacyPath, normalizePath, sitePaths } from '../src/routes.ts'

test('clean routes accept trailing slashes and preserve distinct game modes', () => {
  assert.equal(normalizePath('/'), '/')
  assert.equal(normalizePath('/weapons/'), '/weapons')
  assert.equal(normalizePath('/weapons/daily/'), '/weapons/daily')
  assert(sitePaths.includes('/weapons/practice'))
  assert(sitePaths.includes('/weapons/daily'))
  assert(sitePaths.includes('/feedback'))
  assert.equal(new Set(sitePaths).size, sitePaths.length)
})

test('old shared hash routes migrate only to known internal pages', () => {
  assert.equal(legacyPath('#/'), '/')
  assert.equal(legacyPath('#/weapons/daily'), '/weapons/daily')
  assert.equal(legacyPath('#/feedback/'), '/feedback')
  assert.equal(legacyPath('#//example.com'), undefined)
  assert.equal(legacyPath('#/missing'), undefined)
  assert.equal(legacyPath('#some-heading'), undefined)
})
