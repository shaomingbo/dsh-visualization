import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))

test('installer documents the GitHub source without mutating a profile on help', () => {
  const result = spawnSync(process.execPath, [join(root, 'bin', 'install.js'), '--help'], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /github:shaomingbo\/dsh-visualization#v0\.2\.1/)
  assert.match(result.stdout, /--profile web/)
})
