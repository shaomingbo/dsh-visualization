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
