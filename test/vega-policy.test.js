import assert from 'node:assert/strict'
import test from 'node:test'
import { validateVegaLiteSpec } from '../src/vega-policy.ts'

const SCHEMA = 'https://vega.github.io/schema/vega-lite/v6.json'

const recapBar = {
  $schema: SCHEMA,
  title: 'B02 Review Findings 趋势 — 无收敛迹象',
  width: 500,
  height: 300,
  data: {
    values: [
      { 轮次: '第1轮', 来源: 'Primary (GPT)', 数量: 4 },
      { 轮次: '第1轮', 来源: 'Cross (GLM)', 数量: 2 },
      { 轮次: '第2轮', 来源: 'Primary (GPT)', 数量: 6 },
      { 轮次: '第2轮', 来源: 'Cross (GLM)', 数量: 0 },
    ],
  },
  mark: 'bar',
  encoding: {
    x: { field: '轮次', type: 'ordinal', sort: ['第1轮', '第2轮'] },
    y: { field: '数量', type: 'quantitative', title: '新发现 Findings 数' },
    color: { field: '来源', type: 'nominal', scale: { range: ['#ff6b6b', '#4ecdc4'] } },
    xOffset: { field: '来源' },
  },
}

const recapLine = {
  $schema: SCHEMA,
  title: '累计 Findings 与累计修复 — 两条线始终平行',
  width: 500,
  height: 300,
  data: {
    values: [
      { 轮次: '第1轮后', 类型: '累计发现', 数量: 6 },
      { 轮次: '第1轮后', 类型: '累计修复', 数量: 0 },
      { 轮次: '第2轮后', 类型: '累计发现', 数量: 12 },
      { 轮次: '第2轮后', 类型: '累计修复', 数量: 6 },
    ],
  },
  mark: { type: 'line', point: true },
  encoding: {
    x: { field: '轮次', type: 'ordinal', sort: ['第1轮后', '第2轮后'] },
    y: { field: '数量', type: 'quantitative', title: '问题数' },
    color: { field: '类型', type: 'nominal', scale: { range: ['#ff6b6b', '#4ecdc4'] } },
    strokeDash: { field: '类型', type: 'nominal' },
  },
}

test('official v6 $schema and the recap charts are accepted as inline-only specs', () => {
  assert.equal(validateVegaLiteSpec(recapBar).$schema, SCHEMA)
  assert.equal(validateVegaLiteSpec(recapLine).mark.type, 'line')
  assert.equal(validateVegaLiteSpec({
    mark: 'bar',
    data: { values: [{ x: 'a', y: 1 }] },
    encoding: { x: { field: 'x', type: 'nominal' }, y: { field: 'y', type: 'quantitative' } },
  }).mark, 'bar')
})

test('prompt-advertised static marks are accepted', () => {
  for (const mark of ['boxplot', 'circle', 'errorband', 'errorbar', 'geoshape', 'square']) {
    assert.equal(validateVegaLiteSpec({
      mark,
      data: { values: [{ x: 1, y: 2 }] },
    }).mark, mark)
  }
})

test('remote resources, unknown schemas, and image marks stay rejected', () => {
  assert.throws(
    () => validateVegaLiteSpec({ $schema: 'https://evil.example/schema.json', mark: 'bar', data: { values: [] } }),
    /\$schema must be the official v6 schema URL/,
  )
  assert.throws(
    () => validateVegaLiteSpec({ $schema: 'http://vega.github.io/schema/vega-lite/v6.json', mark: 'bar', data: { values: [] } }),
    /\$schema must be the official v6 schema URL/,
  )
  assert.throws(
    () => validateVegaLiteSpec({ data: { url: 'https://example.com/data.json' }, mark: 'bar' }),
    /property url is not allowed|data must contain only inline values/,
  )
  assert.throws(
    () => validateVegaLiteSpec({ mark: 'bar', data: { values: [{ note: 'see https://example.com' }] } }),
    /external URLs are not allowed/,
  )
  assert.throws(
    () => validateVegaLiteSpec({ mark: 'image', data: { values: [{ x: 1 }] } }),
    /mark image is not allowed/,
  )
})
