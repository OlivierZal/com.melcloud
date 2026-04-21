import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'

const swcPlugin = swc.vite({
  jsc: {
    parser: {
      decorators: true,
      syntax: 'typescript',
    },
    target: 'es2024',
    transform: {
      decoratorVersion: '2022-03',
    },
  },
})

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        '**/index.mts',
        '**/public/**/*.mts',
        'drivers/index.mts',
        'files.mts',
        'settings/**/*.mts',
        'types/app-settings.mts',
        'types/capabilities.mts',
        'types/driver-settings.mts',
        'types/error-log.mts',
        'types/manifest.mts',
        'types/widgets.mts',
        'types/zone.mts',
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
