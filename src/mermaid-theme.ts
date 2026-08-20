import type { MermaidConfig } from 'mermaid'
import type { VisualizationPalette } from './worker-protocol.ts'

/** Mermaid `themeVariables` values controlled by this package. */
export type MermaidThemeVariables = Record<string, string | number | boolean>

const PIE_PALETTE: readonly string[] = [
  '#4285f4', '#ea4335', '#fbbc04', '#34a853', '#ff6d01', '#46bdc6',
  '#a142f4', '#fa7b17', '#9aa0a6', '#5f6368', '#c5221f', '#188038',
]

const LIGHT_QUADRANTS: readonly string[] = ['#dbeafe', '#dcfce7', '#fef3c7', '#f3e8ff']
const DARK_QUADRANTS: readonly string[] = ['#172554', '#153d2e', '#422f12', '#351b4b']
const LIGHT_SCALES: readonly string[] = ['#dbeafe', '#dcfce7', '#fef3c7', '#f3e8ff', '#e0f2fe', '#fce7f3']
const DARK_SCALES: readonly string[] = ['#1e3a5f', '#173f35', '#463814', '#3b2554', '#173b4d', '#4a2039']

/**
 * Build the complete trusted Mermaid configuration for one render.
 * Mermaid remains the layout/parser engine; the palette and CSS follow the
 * two-color, low-contrast surface system popularized by beautiful-mermaid.
 */
export function buildMermaidConfig(
  palette: VisualizationPalette,
  colorScheme: 'light' | 'dark',
  source: string,
  maxEdges: number,
): MermaidConfig {
  return {
    securityLevel: 'strict',
    htmlLabels: false,
    startOnLoad: false,
    suppressErrorRendering: true,
    maxTextSize: 50_000,
    maxEdges,
    theme: 'base',
    look: 'neo',
    fontFamily: palette.fontFamily,
    flowchart: { nodeSpacing: 28, rankSpacing: 44, curve: 'basis', htmlLabels: false },
    sequence: { actorMargin: 64, messageMargin: 46, mirrorActors: false },
    gantt: { barHeight: 28, barGap: 8, topPadding: 32, leftPadding: 64, gridLineStartPadding: 32 },
    kanban: { padding: 16, sectionWidth: 220, useMaxWidth: true },
    quadrantChart: {
      chartWidth: 560,
      chartHeight: 500,
      pointRadius: 5,
      quadrantPadding: 12,
      xAxisLabelPadding: 8,
      yAxisLabelPadding: 8,
      useMaxWidth: true,
    },
    requirement: { useMaxWidth: true, rect_padding: 12, line_height: 22 },
    c4: buildC4Config(palette),
    themeVariables: buildMermaidThemeVariables(palette, colorScheme),
    themeCSS: buildMermaidThemeCss(palette, colorScheme, source),
  }
}

/** Build Mermaid theme variables from DSH semantic colors. */
export function buildMermaidThemeVariables(
  palette: VisualizationPalette,
  colorScheme: 'light' | 'dark' = 'light',
): MermaidThemeVariables {
  const { foreground, muted, accent, border, background, surface, line, fontFamily } = palette
  const dark = colorScheme === 'dark'
  const quadrants = dark ? DARK_QUADRANTS : LIGHT_QUADRANTS
  const scales = dark ? DARK_SCALES : LIGHT_SCALES
  const colorScales = Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
    const color = scales[index % scales.length] ?? surface
    return [
      [`cScale${index}`, color],
      [`cScaleInv${index}`, foreground],
      [`cScaleLabel${index}`, foreground],
      [`lineColor${index}`, line],
    ]
  }).flat())

  return {
    darkMode: dark,
    background,
    fontFamily,
    fontSize: '15px',
    primaryColor: surface,
    primaryTextColor: foreground,
    primaryBorderColor: border,
    lineColor: line,
    secondaryColor: surface,
    tertiaryColor: background,
    noteBkgColor: surface,
    noteTextColor: foreground,
    noteBorderColor: border,
    edgeLabelBackground: background,
    titleColor: foreground,
    textColor: foreground,
    mainBkg: surface,
    nodeBorder: border,
    clusterBkg: background,
    clusterBorder: border,
    nodeTextColor: foreground,
    actorBkg: surface,
    actorBorder: border,
    actorTextColor: foreground,
    actorLineColor: line,
    signalColor: foreground,
    signalTextColor: foreground,
    labelBoxBkgColor: surface,
    labelBoxBorderColor: border,
    labelTextColor: foreground,
    loopTextColor: muted,
    sectionBkgColor: surface,
    sectionBkgColor2: background,
    altSectionBkgColor: background,
    taskBkgColor: accent,
    taskBorderColor: accent,
    taskTextColor: background,
    taskTextLightColor: background,
    taskTextOutsideColor: foreground,
    taskTextDarkColor: foreground,
    taskArrowColor: line,
    todayLineColor: accent,
    gridColor: border,
    ...colorScales,
    ...Object.fromEntries(PIE_PALETTE.map((color, index) => [`pie${index + 1}`, color])),
    pieTitleTextColor: foreground,
    pieSectionTextColor: '#ffffff',
    pieStrokeColor: background,
    pieOpacity: '0.92',
    quadrant1Fill: quadrants[0] ?? surface,
    quadrant2Fill: quadrants[1] ?? surface,
    quadrant3Fill: quadrants[2] ?? surface,
    quadrant4Fill: quadrants[3] ?? surface,
    quadrant1TextFill: foreground,
    quadrant2TextFill: foreground,
    quadrant3TextFill: foreground,
    quadrant4TextFill: foreground,
    quadrantPointFill: accent,
    quadrantPointTextFill: foreground,
    quadrantXAxisTextFill: foreground,
    quadrantYAxisTextFill: foreground,
    quadrantExternalBorderStrokeFill: border,
    quadrantInternalBorderStrokeFill: border,
    quadrantTitleFill: foreground,
    xyChartTitleColor: foreground,
    xyChartAxisTitleColor: foreground,
    xyChartAxisLabelColor: muted,
    xyChartAxisTickColor: muted,
    xyChartGridColor: border,
    xyChartBackgroundColor: background,
    xyChartDatasetFillColor: accent,
    xyChartDatasetStrokeColor: accent,
    requirementBackground: surface,
    requirementBorderColor: border,
    requirementBorderSize: '1px',
    requirementTextColor: foreground,
    relationColor: line,
    relationLabelBackground: background,
    relationLabelColor: muted,
    requirementEdgeLabelBackground: background,
  }
}

function buildC4Config(palette: VisualizationPalette): NonNullable<MermaidConfig['c4']> {
  const internal = palette.surface
  const external = palette.background
  const pairs = {
    person: internal,
    external_person: external,
    system: internal,
    system_db: internal,
    system_queue: internal,
    external_system: external,
    external_system_db: external,
    external_system_queue: external,
    container: internal,
    container_db: internal,
    container_queue: internal,
    external_container: external,
    external_container_db: external,
    external_container_queue: external,
    component: internal,
    component_db: internal,
    component_queue: internal,
    external_component: external,
    external_component_db: external,
    external_component_queue: external,
  } as const
  return {
    diagramMarginX: 24,
    diagramMarginY: 24,
    c4ShapeMargin: 28,
    c4ShapePadding: 14,
    boxMargin: 10,
    width: 200,
    height: 128,
    c4ShapeInRow: 3,
    c4BoundaryInRow: 2,
    useMaxWidth: true,
    wrap: true,
    boundaryFontFamily: palette.fontFamily,
    boundaryFontSize: 14,
    messageFontFamily: palette.fontFamily,
    messageFontSize: 13,
    ...Object.fromEntries(Object.entries(pairs).flatMap(([name, fill]) => [
      [`${name}_bg_color`, fill],
      [`${name}_border_color`, palette.border],
      [`${name}FontFamily`, palette.fontFamily],
      [`${name}FontSize`, 14],
    ])),
  }
}

function buildMermaidThemeCss(
  palette: VisualizationPalette,
  colorScheme: 'light' | 'dark',
  source: string,
): string {
  const shadow = colorScheme === 'dark' ? 'rgba(0,0,0,0.32)' : 'rgba(15,23,42,0.10)'
  const common = `
    svg { background: ${palette.background}; }
    text, .label, .nodeLabel { font-family: ${palette.fontFamily}; }
    .node rect, .node polygon, .node path, .node circle, .actor, .reqBox {
      stroke-width: 1px;
      filter: drop-shadow(0 2px 4px ${shadow});
    }
    .node rect, .actor, .reqBox { rx: 10px; ry: 10px; }
    .cluster rect { rx: 12px; ry: 12px; stroke-width: 1px; }
    .flowchart-link, .messageLine0, .messageLine1, .relationshipLine { stroke-width: 1.25px; }
    .edgeLabel rect, .labelBkg { fill: ${palette.background}; opacity: 0.96; }
  `
  const first = source.split(/\r?\n/).find(line => line.trim().length > 0)?.trim() ?? ''
  if (first.startsWith('kanban')) {
    return `${common}
      .sections .cluster rect { fill: ${palette.surface} !important; stroke: ${palette.border} !important; }
      .items .node rect { fill: ${palette.background} !important; stroke: ${palette.border} !important; }
      .cluster-label text, .items text { fill: ${palette.foreground} !important; }
    `
  }
  if (first.startsWith('C4')) {
    return `${common}
      text { fill: ${palette.foreground} !important; }
      .person-man rect, .person-man path { stroke: ${palette.border} !important; stroke-width: 1px !important; }
      g:not(.person-man) > rect[fill="none"] { stroke: ${palette.border} !important; }
      g:not(.person-man) > line, g:not(.person-man) > path[fill="none"] { stroke: ${palette.line} !important; }
      marker path { fill: ${palette.line} !important; stroke: ${palette.line} !important; }
    `
  }
  return common
}
