import { createApiContractSuite } from '@olivierzal/homey-kit/testing'

import appConfig from '../../.homeycompose/app.json' with { type: 'json' }
import api from '../../api.mts'
import ataGroupSettingApi from '../../widgets/ata-group-setting/api.mts'
import ataGroupSettingConfig from '../../widgets/ata-group-setting/widget.compose.json' with { type: 'json' }
import chartsApi from '../../widgets/charts/api.mts'
import chartsConfig from '../../widgets/charts/widget.compose.json' with { type: 'json' }

// The declaration half of the API contract: what each surface exposes
// against what its manifest declares. The call-site half (every path a
// webview writes, under a declared method) lives in
// tests/unit/api-route-guards.test.ts. The suite itself is single-sourced
// in @olivierzal/homey-kit/testing; only the tables below are this app's.

// Every surface's handler union: the type parameter is the compile-time
// half of the contract — the call only typechecks when the whole union
// is callable.
type Handler =
  | (typeof api)[keyof typeof api]
  | (typeof ataGroupSettingApi)[keyof typeof ataGroupSettingApi]
  | (typeof chartsApi)[keyof typeof chartsApi]

createApiContractSuite<Handler>([
  { api, config: appConfig, name: 'app API' },
  {
    api: ataGroupSettingApi,
    config: ataGroupSettingConfig,
    name: 'ata-group-setting widget API',
  },
  { api: chartsApi, config: chartsConfig, name: 'charts widget API' },
])
