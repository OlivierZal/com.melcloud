import swc from 'unplugin-swc'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: false,
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          decorators: true,
          syntax: 'typescript',
        },
        transform: {
          decoratorVersion: '2022-03',
        },
      },
    }),
  ],
  test: {
    coverage: {
      exclude: [
        '**/index.mts',
        'files.mts',
        'settings/**',
        'types/ata.mts',
        'types/bases.mts',
        'types/capabilities.mts',
        'types/erv.mts',
        'types/manifest.mts',
        'types/settings.mts',
        'types/widgets.mts',
        'widgets/*/public/**',
      ],
      include: ['**/*.mts'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    include: ['tests/**/*.test.ts'],
  },
})
