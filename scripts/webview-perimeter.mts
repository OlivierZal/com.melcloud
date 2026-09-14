// The webview perimeter, declared once and shared by the bundler, the
// lint and the floor suite: `tests/unit/webview-floor.test.ts` asks
// esbuild for the metafile of these entry points and checks every
// input it emits against these globs, so the two cannot drift apart
// unnoticed.
export const entryPoints: readonly string[] = [
  'widgets/ata-group-setting/public/index.mts',
  'widgets/charts/public/index.mts',
  'settings/index.mts',
]

export const webviewFloorFiles: readonly string[] = [
  'public/**/*.mts',
  'settings/**/*.mts',
  // Cross-surface by contract: `DAYS_MAX` ships into the charts
  // bundle, so the file holds the floor even though node-side code
  // reads it too.
  'types/widgets.mts',
  'widgets/*/public/**/*.mts',
]
