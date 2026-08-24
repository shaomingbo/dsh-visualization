import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMermaidConfig, buildMermaidThemeVariables } from '../src/mermaid-theme.ts'

const light = {
  foreground: '#27272a',
  muted: '#71717a',
  accent: '#2563eb',
  border: 'rgba(24,24,27,0.14)',
  background: '#ffffff',
  surface: '#f4f4f5',
  line: 'rgba(24,24,27,0.30)',
  fontFamily: 'system-ui',
}
const dark = {
  foreground: '#f4f4f5',
  muted: '#a1a1aa',
  accent: '#60a5fa',
  border: 'rgba(255,255,255,0.14)',
  background: '#18181b',
  surface: '#27272a',
  line: 'rgba(255,255,255,0.28)',
  fontFamily: 'system-ui',
}

test('theme variables distinguish light and dark derivation', () => {
  const lightTheme = buildMermaidThemeVariables(light, 'light')
  const darkTheme = buildMermaidThemeVariables(dark, 'dark')
  assert.equal(lightTheme.darkMode, false)
  assert.equal(darkTheme.darkMode, true)
  assert.notEqual(lightTheme.quadrant1Fill, darkTheme.quadrant1Fill)
  assert.equal(darkTheme.requirementTextColor, dark.foreground)
  assert.equal(darkTheme.relationColor, dark.line)
  assert.equal(darkTheme.cScaleLabel0, dark.foreground)
})

test('Kanban config uses modern section layout and family CSS', () => {
  const config = buildMermaidConfig(dark, 'dark', 'kanban\n  todo[Todo]', 500)
  assert.equal(config.theme, 'base')
  assert.equal(config.look, 'neo')
  assert.equal(config.maxEdges, 500)
  assert.equal(config.kanban?.sectionWidth, 220)
  assert.match(config.themeCSS ?? '', /\.sections \.cluster rect/)
  assert.match(config.themeCSS ?? '', /drop-shadow/)
})

test('Mindmap circle labels are horizontally centered', () => {
  const config = buildMermaidConfig(light, 'light', 'mindmap\n  root((Context))', 500)
  assert.match(config.themeCSS ?? '', /\.mindmap-node > circle\.label-container \+ \.label text\s*\{[^}]*text-anchor:\s*middle/)
})

test('C4 config projects palette into every shape family and fixes text', () => {
  const config = buildMermaidConfig(light, 'light', 'C4Context\nPerson(user, "User")', 500)
  assert.equal(config.c4?.person_bg_color, light.surface)
  assert.equal(config.c4?.external_person_bg_color, light.background)
  assert.equal(config.c4?.system_db_border_color, light.border)
  assert.equal(config.c4?.componentFontFamily, light.fontFamily)
  assert.match(config.themeCSS ?? '', /\.person-man/)
  assert.match(config.themeCSS ?? '', /text \{ fill: #27272a !important;/)
})

test('Quadrant and requirement configs remain responsive and readable', () => {
  const config = buildMermaidConfig(dark, 'dark', 'quadrantChart\nx-axis Low --> High', 500)
  assert.equal(config.quadrantChart?.useMaxWidth, true)
  assert.equal(config.requirement?.useMaxWidth, true)
  assert.equal(config.themeVariables?.quadrantPointTextFill, dark.foreground)
  assert.equal(config.themeVariables?.requirementBackground, dark.surface)
})
