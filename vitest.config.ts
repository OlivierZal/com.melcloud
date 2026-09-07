import { coverageDefaults } from '@olivierzal/configs/vitest-coverage'
import { type ViteUserConfig, defineConfig } from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  test: {
    coverage: {
      ...coverageDefaults,
      exclude: ['.homeybuild/**'],
      include: ['**/*.mts'],
    },
    projects: [
      {
        test: {
          include: ['tests/unit/*device*.test.ts'],
          name: 'device',
          setupFiles: ['tests/setup-device-mocks.ts'],
        },
      },
      {
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
