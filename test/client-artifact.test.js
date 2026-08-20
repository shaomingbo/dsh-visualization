import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const clientPath = join(root, 'lib', 'client.js')
const workerPath = join(root, 'lib', 'vega-lite.worker.js')
const nodeBuiltinRequire = /(?<![\w.$])require\("(?:module|url|fs|path|os|util|node:[^"]+)"\)/
const staticModuleReference = /^(?:import|export)\s/m

test('browser artifact registers dsh-visualization without Node factory requires', () => {
  const source = readFileSync(clientPath, 'utf8')
  assert.match(source, /window\.__ModuleLoader__\.load\(/)
  assert.match(source, /id: "dsh-visualization"/)
  assert.match(source, /\/plugins\/dsh-visualization\/vega-lite\.worker\.js/)
  assert.match(source, /dataset\.plugin = "dsh-visualization"/)
  assert.match(source, /MERMAID_KEYS\s*=\s*\[\s*"mermaid",\s*"text"/)
  for (const key of ['kanban', 'quadrantchart', 'c4context', 'requirementdiagram']) {
    assert.match(source, new RegExp(`\\b${key}:`), `client bundle omits normalized fence key ${key}`)
  }
  for (const header of ['quadrantChart', 'C4Context', 'requirementDiagram']) {
    assert.match(source, new RegExp(`"${header}"`), `client bundle omits canonical header ${header}`)
  }
  assert.match(source, /darkMode:/)
  assert.match(source, /\.person-man/)
  assert.match(source, /compactC4PersonTextY/)
  assert.match(source, /UpdateLayoutConfig/)
  assert.match(source, /\.sections \.cluster rect/)
  assert.doesNotMatch(source, nodeBuiltinRequire)

  let handoff
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(value) {
          handoff = value
        },
      },
    },
  }
  vm.runInNewContext(source, sandbox, { filename: 'client.js' })
  assert.equal(handoff.id, 'dsh-visualization')
  assert.equal(typeof handoff.factory, 'function')
})

test('worker artifact is self-contained and uses no Node runtime imports', () => {
  const source = readFileSync(workerPath, 'utf8')
  assert.match(source, /addEventListener\("message"/)
  assert.doesNotMatch(source, staticModuleReference)
  assert.doesNotMatch(source, nodeBuiltinRequire)
})
