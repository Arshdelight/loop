let mermaidReady = false

/** Read a CSS theme variable (with a fallback for non-DOM/test environments). */
function readThemeColor(name: string, fallback: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  } catch {
    return fallback
  }
}

export function ensureMermaid(): Promise<typeof import('mermaid').default> {
  return import('mermaid').then(m => {
    if (!mermaidReady) {
      // Style diagrams with the host theme's --loop-* token variables
      // instead of mermaid's default palette — nodes/edges/labels use the
      // same colors as the rest of the loop UI.
      m.default.initialize({
        startOnLoad: false,
        theme: 'base',
        securityLevel: 'loose',
        themeVariables: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          // Node fill / border / text
          primaryColor: readThemeColor('--loop-hover', '#2a2723'),
          primaryBorderColor: readThemeColor('--loop-line', '#3a362f'),
          primaryTextColor: readThemeColor('--loop-main', '#ece8e2'),
          // Edges + labels
          lineColor: readThemeColor('--loop-muted', '#9a958c'),
          textColor: readThemeColor('--loop-main', '#ece8e2'),
          edgeLabelBackground: readThemeColor('--loop-surface', '#201e1b'),
          // Subgraph clusters
          clusterBkg: readThemeColor('--loop-surface', '#201e1b'),
          clusterBorder: readThemeColor('--loop-line', '#3a362f'),
          titleColor: readThemeColor('--loop-main', '#ece8e2'),
        },
      })
      mermaidReady = true
    }
    return m.default
  })
}
