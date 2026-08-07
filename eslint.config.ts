import { homeyApp } from '@olivierzal/configs/eslint/homey-app'
import { type Config, defineConfig } from 'eslint/config'

const config: Config[] = defineConfig([
  { ignores: ['.homeybuild/', 'coverage/'] },
  ...homeyApp({
    bundledSourceGlobs: ['widgets/**'],
    defaultExportFiles: [
      '**/api.mts',
      'app.mts',
      'drivers/*/{device,driver}.mts',
    ],
    jsdocFiles: [
      '{api,app,files}.mts',
      'drivers/**/*.mts',
      'lib/**/*.mts',
      'types/**/*.mts',
    ],
    templateExpressionAllow: [
      // Query-string serialization: interpolating URLSearchParams IS
      // its canonical stringification.
      { from: 'lib', name: 'URLSearchParams' },
    ],
    untypedDoubleTestFiles: [
      'tests/unit/app.test.ts',
      'tests/unit/*-{device,driver}.test.ts',
    ],
    webviewFloorFiles: [
      'public/**/*.mts',
      'settings/**/*.mts',
      'widgets/*/public/**/*.mts',
    ],
  }),
  {
    // filename-case also checks directory names, but melcloud_atw and
    // melcloud_erv are Homey driver ids that must match their folder
    // names.
    files: ['**/*.{ts,mts}'],
    rules: { 'unicorn/filename-case': 'off' },
  },
  {
    files: ['settings/index.mts'],
    rules: {
      // The settings webview is a single esbuild entry point; its
      // manager classes live in one bundled file by design.
      'max-classes-per-file': 'off',
    },
  },
])

export default config
