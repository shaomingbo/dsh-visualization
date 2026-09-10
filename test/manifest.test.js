import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

test('declares an installable DSH Web bundle and client entry', () => {
  assert.equal(pkg.name, 'dsh-visualization')
  assert.equal(pkg.version, '0.3.1')
  assert.deepEqual(pkg.dsh.bundle, { patch: './cordis.patch.yml' })
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.deepEqual(pkg.dsh.client.inject, [
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-ui-theme',
  ])
  assert.equal(pkg.exports['./client'], './lib/client.js')
  assert.equal(pkg.exports['./skill'], './lib/skill.js')
  assert.equal(pkg.exports['./cordis.patch.yml'], './cordis.patch.yml')
  for (const file of ['lib/index.js', 'lib/invariant.js', 'lib/client.js', 'lib/skill.js', 'lib/vega-lite.worker.js', 'skill']) {
    assert.ok(pkg.files.includes(file), `files omits ${file}`)
  }
})

test('patch mounts the exact package identity with an isolated skill entry', () => {
  const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
  assert.match(patch, /id: dsh-visualization\b/)
  assert.match(patch, /name: dsh-visualization\b/)
  assert.match(patch, /id: dsh-visualization-skill/)
  assert.match(patch, /name: dsh-visualization\/skill/)
})
