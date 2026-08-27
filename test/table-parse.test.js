import assert from 'node:assert/strict'
import test from 'node:test'
import { parseJsonTable } from '../src/client/parse-json-table.ts'

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
