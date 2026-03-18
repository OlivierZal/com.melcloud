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
        'types/**/*.mts',
        'settings/**/*.mts',
        'widgets/**/*.mts',
      ],
      include: ['**/*.mts', 'lib/**/*.mts'],
    },
    include: ['tests/**/*.test.mts'],
  },
})
