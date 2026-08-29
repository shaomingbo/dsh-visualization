import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const frame = readFileSync(fileURLToPath(new URL('../src/VisualizationFrame.tsx', import.meta.url)), 'utf8')
const css = readFileSync(fileURLToPath(new URL('../src/VisualizationFrame.module.css', import.meta.url)), 'utf8')
const locales = readFileSync(fileURLToPath(new URL('../src/client/locales.ts', import.meta.url)), 'utf8')

test('preview offers an accessible expanded view with zoom controls', () => {
  assert.match(frame, /createPortal\(/)
  assert.match(frame, /role="dialog"/)
  assert.match(frame, /aria-modal="true"/)
  assert.match(frame, /event\.key === 'Escape'/)
  assert.match(frame, /event\.key === '\+'/)
  assert.match(frame, /event\.key === '-'/)
  assert.match(frame, /fitToWindow/)
  assert.match(frame, /readSvgDimensions/)
  assert.match(frame, /setPointerCapture/)
  assert.match(frame, /canvas\.scrollLeft = gesture\.scrollLeft - deltaX/)
  assert.match(frame, /canvas\.scrollTop = gesture\.scrollTop - deltaY/)
  assert.match(frame, /onPointerCancel/)
  assert.match(css, /\.previewTrigger\s*\{[\s\S]*?cursor:\s*zoom-in;/)
  assert.match(css, /\.lightboxCanvas\s*\{[\s\S]*?overflow:\s*auto;/)
  assert.match(css, /\.lightboxCanvas\s*\{[\s\S]*?cursor:\s*grab;/)
  assert.match(css, /\.lightboxCanvas\s*\{[\s\S]*?touch-action:\s*none;/)
  assert.match(css, /\.lightboxCanvasPanning\s*\{[\s\S]*?cursor:\s*grabbing;/)
})

test('expanded-view controls are localized for Mermaid and Vega-Lite', () => {
  for (const key of ['expand', 'expandedView', 'close', 'zoomIn', 'zoomOut', 'resetZoom', 'fit', 'dragToPan']) {
    assert.equal((locales.match(new RegExp(`'${key}':`, 'g')) ?? []).length, 4, `expected four locale entries for ${key}`)
  }
})

test('offscreen lazy previews show progress instead of the failure label', () => {
  const mermaid = readFileSync(fileURLToPath(new URL('../src/MermaidVisualization.tsx', import.meta.url)), 'utf8')
  const vega = readFileSync(fileURLToPath(new URL('../src/VegaLiteVisualization.tsx', import.meta.url)), 'utf8')
  // A frame whose render has merely not started yet (IntersectionObserver
  // still waiting) must read as in-progress, never as "cannot render safely".
  assert.match(frame, /props\.pending === true \|\| props\.waiting === true[\s\S]*?props\.labels\.rendering/)
  assert.match(frame, /waiting=\{props\.waiting\}/)
  for (const source of [mermaid, vega]) {
    assert.match(source, /waiting=\{visibility === 'waiting'\}/)
  }
  // The failure label stays reserved for the post-attempt error branch.
  assert.match(frame, /props\.error !== undefined[\s\S]*?props\.labels\.unavailable/)
})
