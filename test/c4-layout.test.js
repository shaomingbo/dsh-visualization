import assert from 'node:assert/strict'
import test from 'node:test'
import { compactC4PersonTextY } from '../src/c4-layout.ts'

test('removed C4 person icons do not leave a blank vertical slot', () => {
  assert.equal(compactC4PersonTextY(167, 177, 48), 167)
  assert.equal(compactC4PersonTextY(233, 177, 48), 185)
  assert.equal(compactC4PersonTextY(272, 177, 48), 224)
})
