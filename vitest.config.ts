import { swcPlugin } from '@olivierzal/configs/vitest-swc'
import { type ViteUserConfig, defineConfig } from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  test: {
    coverage: {
      // Named, file-scoped residue — never a directory sweep, and every
      // line below carries its own count.
      //
      // The two packaging orchestrators measure 0 %: they are thin —
      // table constants plus the esbuild and fs calls that consume them,
      // with their logic already extracted into `webview-stamp.mts` and
      // `sort-keys-deep.mts`, both at 100 %. They are FINISHABLE, not
      // out of scope: com.melcloud.extension covers its own `bundle.mts`
      // end to end on a temporary filesystem (7 cases), and that suite is
      // the template for closing these two.
      //
      // The charts widget is TESTED — 41 cases against the real page with
      // Chart.js stood in for — and measures 100 % statements, 100 %
      // functions, 94.20 % branches. Eight branches remain, each a
      // fallback TypeScript demands on a read no input reaches: the
      // palette lookup past a non-empty literal array (205), `labels ?? []`
      // on configs this module builds WITH labels (811, 936, 1203, 1204),
      // `label === undefined` on datasets it names itself (796, 944), and
      // the redraw guard for a picker change landing before the first draw
      // arms its timer (1117). Closing them means narrowing this module's
      // own config type so `labels` stops being optional — a restructure,
      // not more tests.
      //
      // Every other webview surface of this app is at a real 100 %.
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
