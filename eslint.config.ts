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
    wireNamingEntries: [
      // MELCloud Classic state fields: the ATA group widget posts these
      // names verbatim, so they are the wire's, not ours. Enumerated so
      // that a new PascalCase property fails until it is recognised as
      // wire vocabulary.
      {
        filter: {
          match: true,
          regex:
            '^(FanSpeed|OperationMode|Power|SetTemperature|VaneHorizontalDirection|VaneHorizontalSwing|VaneVerticalDirection|VaneVerticalSwing)$',
        },
        format: null,
        selector: 'typeProperty',
      },
      // The charts widget keys its color maps by the report series and
      // mode names the wire speaks — the lookup is by runtime name, and
      // the locales translate the same vocabulary under
      // `widgets.charts.series.*`.
      {
        filter: {
          match: true,
          regex:
            '^(ActualRecovery|Auto|AutoMode|Consumed|CoolMode|Cooling|Dry|DryMode|Fan|FansStopped|FlowTemperature|FlowTemperatureBoiler|FlowTemperatureZone1|FlowTemperatureZone2|FreezeStat|HeatMode|Heating|HotWater|LegionellaPrevention|MixingTankWaterTemperature|Other|OutdoorTemperature|Power|PowerOff|Produced|ProducedCooling|ProducedHeating|ProducedHotWater|ReturnTemperature|ReturnTemperatureBoiler|ReturnTemperatureZone1|ReturnTemperatureZone2|RoomTemperature|RoomTemperatureZone1|RoomTemperatureZone2|SetTankWaterTemperature|SetTemperature|SetTemperatureZone1|SetTemperatureZone2|Stop|TankWaterTemperature|VentilationMode)$',
        },
        format: null,
        selector: 'objectLiteralProperty',
      },
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
  {
    // Shipped node-side regexes stay on the `u` flag: older Homey
    // Pro (2016-2019) firmwares run a pre-Node-20 runtime where the
    // es2024 `v` flag is a parse-time SyntaxError — the 2026-08
    // boot-crash root cause.
    files: ['*.mts', 'drivers/**/*.mts', 'lib/**/*.mts'],
    rules: { 'require-unicode-regexp': ['error', { requireFlag: 'u' }] },
  },
])

export default config
