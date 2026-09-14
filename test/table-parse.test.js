import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parseJsonTable, parseJsonTableOutcome } from '../src/client/parse-json-table.ts'
import { parseTable, parseTableOutcome } from '../src/client/parse.ts'
import { dataTableEn, dataTableZh } from '../src/client/locales.ts'

/** Assert the body fails and return its technical failure. */
function failureOf(source) {
  const outcome = parseJsonTableOutcome(source)
  assert.equal(outcome.ok, false)
  if (outcome.ok) throw new Error('unreachable')
  return outcome.failure
}

test('json-table accepts explicit columns and row arrays', () => {
  const source = JSON.stringify({
    columns: ['能力', '当前 Harness', '说明'],
    rows: [
      ['手动检测更新', '部分支持', '可转发 pnpm outdated，但不会主动通知'],
      ['手动升级', '支持', 'dsh plugin --profile web update <包名>'],
    ],
  })
  assert.deepEqual(parseJsonTable(source), {
    columns: ['能力', '当前 Harness', '说明'],
    rows: [
      ['手动检测更新', '部分支持', '可转发 pnpm outdated，但不会主动通知'],
      ['手动升级', '支持', 'dsh plugin --profile web update <包名>'],
    ],
  })
})

test('json-table keeps supporting arrays of records', () => {
  assert.deepEqual(parseJsonTable('[{"name":"alpha","count":2}]'), {
    columns: ['name', 'count'],
    rows: [['alpha', '2']],
  })
})

test('json-table accepts a matrix whose first row is the header', () => {
  assert.deepEqual(parseJsonTable('[["Finding","级别"],["AST-1","P1"],["AST-2","P2"]]'), {
    columns: ['Finding', '级别'],
    rows: [['AST-1', 'P1'], ['AST-2', 'P2']],
  })
})

test('json-table matrix stringifies non-string cells in the header and body', () => {
  assert.deepEqual(parseJsonTable('[["id",1,true],["a",2,false]]'), {
    columns: ['id', '1', 'true'],
    rows: [['a', '2', 'false']],
  })
})

test('json-table matrix pads ragged rows to the header width', () => {
  assert.deepEqual(parseJsonTable('[["a","b","c"],[1,2],[3,4,5,6]]'), {
    columns: ['a', 'b', 'c'],
    rows: [['1', '2', ''], ['3', '4', '5']],
  })
})

test('json-table matrix with only a header keeps zero data rows', () => {
  assert.deepEqual(parseJsonTable('[["col"]]'), { columns: ['col'], rows: [] })
})

test('json-table empty array yields an empty table', () => {
  assert.deepEqual(parseJsonTable('[]'), { columns: [], rows: [] })
})

test('json-table rejects mixed record and matrix rows with a reason', () => {
  const failure = failureOf('[{"a":1},["b"]]')
  assert.equal(failure.stage, 'mixed-rows')
  assert.match(failure.detail, /mixes object records and row arrays/)
})

test('json-table names primitive rows instead of claiming mixed rows', () => {
  const numbers = failureOf('[1,2]')
  assert.equal(numbers.stage, 'shape')
  assert.match(numbers.detail, /found number at index 0/)
  const nullRow = failureOf('[null]')
  assert.equal(nullRow.stage, 'shape')
  assert.match(nullRow.detail, /found null at index 0/)
  const recordThenPrimitive = failureOf('[{"a":1},2]')
  assert.equal(recordThenPrimitive.stage, 'shape')
  assert.match(recordThenPrimitive.detail, /found number at index 1/)
})

test('json-table matrix keeps duplicate and empty header cells as authored', () => {
  assert.deepEqual(parseJsonTable('[["a","a"],["1","2"]]'), {
    columns: ['a', 'a'],
    rows: [['1', '2']],
  })
  assert.deepEqual(parseJsonTable('[[],["x"]]'), { columns: [], rows: [[]] })
})

test('json-table reports the JSON syntax error as the failure detail', () => {
  const failure = failureOf('{"Finding", "级别"}')
  assert.equal(failure.stage, 'json-syntax')
  assert.match(failure.detail, /Expected/)
  assert.match(failure.detail, /position \d+/)
})

test('json-table names the offending top-level type', () => {
  assert.match(failureOf('"text"').detail, /got string/)
  assert.match(failureOf('42').detail, /got number/)
  assert.match(failureOf('null').detail, /got null/)
})

test('json-table object form missing columns or rows reports the shape requirement', () => {
  const failure = failureOf('{"rows":[["a"]]}')
  assert.equal(failure.stage, 'shape')
  assert.match(failure.detail, /"columns": string\[\]/)
})

test('back-compat parseJsonTable still returns null for every failure', () => {
  assert.equal(parseJsonTable('{"Finding", "级别"}'), null)
  assert.equal(parseJsonTable('[{"a":1},["b"]]'), null)
  assert.equal(parseJsonTable('42'), null)
})

test('parseTableOutcome passes csv through and forwards json-table failures', () => {
  assert.deepEqual(parseTableOutcome('csv', 'a,b\n1,2'), {
    ok: true,
    table: { columns: ['a', 'b'], rows: [['1', '2']] },
  })
  const failure = parseTableOutcome('json-table', '{"Finding", "级别"}')
  assert.equal(failure.ok, false)
  assert.notEqual(parseTable('csv', 'a,b\n1,2'), null)
  assert.equal(parseTable('json-table', '{"Finding"}'), null)
  assert.equal(parseTable('python', 'x = 1'), null)
})

test('error.cause is localized in both dictionaries with a detail placeholder', () => {
  assert.equal(dataTableZh['error.cause'], '失败原因：{detail}')
  assert.equal(dataTableEn['error.cause'], 'Cause: {detail}')
})

test('both fence wirings use the outcome API and forward errorDetail', () => {
  for (const file of ['DataTableCodeBlock.tsx', 'LegacyCodeBlock.tsx']) {
    const source = readFileSync(new URL(`../src/client/${file}`, import.meta.url), 'utf8')
    assert.match(source, /parseTableOutcome\(/, `${file} bypasses parseTableOutcome`)
    assert.match(source, /errorDetail=/, `${file} does not forward errorDetail`)
    assert.doesNotMatch(source, /\bparseTable\(/, `${file} still calls the null-only parseTable`)
  }
})