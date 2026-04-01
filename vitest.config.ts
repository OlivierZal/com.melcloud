import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'

export default defineConfig({
  oxc: false,
  plugins: [
    swc.vite({
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
    }),
  ],
  test: {
    coverage: {
      exclude: ['**/public/**/*.mts', 'settings/**/*.mts'],
      include: ['**/*.mts'],
      reporter: ['text', 'lcov'],
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
