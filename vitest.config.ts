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
      // `webview-stamp.mts` and `sort-keys-deep.mts`, both covered. The
      // charts exclusion shrinks to nothing as the campaign lands;
      // never widen either.
      exclude: [
        '.homeybuild/**',
        'scripts/bundle.mts',
        'scripts/sync-capability-definitions.mts',
        'widgets/charts/public/**/*.mts',
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
