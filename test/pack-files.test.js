import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const required = [
  'bin/install.js',
  'cordis.patch.yml',
  'lib/index.js',
  'lib/invariant.js',
  'lib/client.js',
  'lib/vega-lite.worker.js',
  'README.md',
  'README.zh.md',
  'LICENSE',
]

test('npm pack ships every runtime and companion artifact', () => {
  const packed = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(packed.status, 0, packed.stderr || packed.stdout)
  const payload = JSON.parse(packed.stdout)
  const entry = Array.isArray(payload) ? payload[0] : payload
  const names = new Set((entry.files ?? []).map(file => file.path))
  for (const file of required) {
    assert.ok(names.has(file), `npm pack omits ${file}`)
  }
})
