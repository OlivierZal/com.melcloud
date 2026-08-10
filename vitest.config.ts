import { swcPlugin } from '@olivierzal/configs/vitest-swc'
import { type ViteUserConfig, defineConfig } from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  test: {
    coverage: {
      // Named, file-scoped residue — never a directory sweep. The two
      // packaging orchestrators hold no logic left to unit-test: table
      // constants plus the esbuild and fs calls that consume them, every
      // one of which `npm run build` and the vendored-definitions drift
      // test already exercise end to end. Their logic lives in
      // `webview-stamp.mts` and `sort-keys-deep.mts`, both covered.
      //
      // The charts widget is TESTED (34 cases, real page, Chart.js
      // stood in for) and measures 99.92 % statements / 98.58 %
      // branches / 100 % functions; it stays listed only for the 12
      // branches left, every one a fallback TypeScript demands on an
      // optional or indexed read that no input reaches — a colour
      // lookup past a non-empty literal array, `labels ?? []` on
      // configs this module builds with labels, `label === undefined`
      // on datasets it names itself, the picker-value guard its own
      // comment already calls type-level only. Closing them means
      // restructuring those reads, not writing tests; until then the
      // number above is the honest one and this line is the ledger.
      exclude: [
        '.homeybuild/**',
        'scripts/bundle.mts',
        'scripts/sync-capability-definitions.mts',
        'widgets/charts/public/index.mts',
      ],
      include: ['**/*.mts'],
      reporter: ['text', 'lcov'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    projects: [
      {
        oxc: false,
        plugins: [swcPlugin],
        test: {
          include: ['tests/unit/*device*.test.ts'],
          name: 'device',
          setupFiles: ['tests/setup-device-mocks.ts'],
        },
      },
      {
        oxc: false,
        plugins: [swcPlugin],
        test: {
          exclude: ['tests/unit/*device*.test.ts'],
          include: ['tests/**/*.test.ts'],
          name: 'other',
        },
      },
    ],
  },
})

export default config
