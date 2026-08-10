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
      // Every webview surface of this app is at a real 100 %.
      exclude: ['.homeybuild/**'],
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
