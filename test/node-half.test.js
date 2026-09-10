import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import test from 'node:test'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const nodeHalf = await import(join(root, 'lib', 'index.js'))

test('node half registers only the four static prompt sections', () => {
  const sections = []
  nodeHalf.apply({
    systemPrompt: {
      section(value) {
        sections.push(value)
        return () => {}
      },
    },
  })
  assert.deepEqual(sections.map(section => [section.name, section.order]), [
    ['ui:data-table-fences', 185],
    ['ui:mermaid', 190],
    ['ui:vega-lite', 190],
    ['ui:dsh-svg', 191],
  ])
  assert.match(sections[0].text, /"columns"/)
  assert.match(sections[0].text, /"rows"/)
  assert.match(sections[1].text, /kanban/)
  assert.match(sections[1].text, /never a `text` fence/)
  assert.match(sections[1].text, /verifymethod/)
  assert.match(sections[1].text, /A -\.->\|label\| B/)
  assert.match(sections[1].text, /punctuation-heavy node labels/)
  assert.match(sections[1].text, /09：45/)
  assert.doesNotMatch(sections[1].text, /xychart-beta|sankey-beta/)
  assert.match(sections[2].text, /inline-only Vega-Lite/)
  assert.match(sections[3].text, /dsh-svg/)
  assert.match(sections[3].text, /viewBox/)
  assert.match(sections[3].text, /dsh-diagram-design/)
  assert.match(sections[3].text, /marker/)
  // The static channel must not take over ordinary source fences.
  assert.match(sections[3].text, /`html`, `svg`, or `xml`/)
  // Routing stays conservative: Mermaid remains the default diagram path.
  assert.match(sections[3].text, /stay in Mermaid/)
})
