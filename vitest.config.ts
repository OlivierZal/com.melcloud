import { swcPlugin } from '@olivierzal/configs/vitest-swc'
import { type ViteUserConfig, defineConfig } from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  test: {
    coverage: {
      // The remaining webview exclusion shrinks as the real-coverage
      // campaign lands zone by zone; never widen it.
      exclude: ['.homeybuild/**', '**/public/**/*.mts', 'scripts/**/*.mts'],
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
