import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const css = readFileSync(fileURLToPath(new URL('../src/VisualizationFrame.module.css', import.meta.url)), 'utf8')

test('visualization toolbar uses compact minimal tabs', () => {
  assert.match(css, /\.toolbar\s*\{[\s\S]*?min-height:\s*40px;/)
  assert.match(css, /\.toolbar\s*\{[\s\S]*?background:\s*var\(--dsw-alias-bg-layer-1/)
  assert.match(css, /\.tabs \[aria-selected='true'\]::after/)
  const controlRule = css.match(/\.toolbar button,\s*\.toolbar a,\s*\.status button\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(controlRule, /box-sizing:\s*border-box;/)
  assert.match(controlRule, /display:\s*inline-flex;/)
  assert.match(controlRule, /align-items:\s*center;/)
  const activeRule = css.match(/\.tabs \[aria-selected='true'\]\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.doesNotMatch(activeRule, /background:/)
})
