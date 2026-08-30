import { findContractBreach } from '@olivierzal/homey-kit/testing'
import { describe, expect, expectTypeOf, it } from 'vitest'

import type { AuthenticationResult } from '../../types/api.mts'
import appConfig from '../../.homeycompose/app.json' with { type: 'json' }
import api from '../../api.mts'
import ataGroupSettingApi from '../../widgets/ata-group-setting/api.mts'
import ataGroupSettingConfig from '../../widgets/ata-group-setting/widget.compose.json' with { type: 'json' }
import chartsApi from '../../widgets/charts/api.mts'
import chartsConfig from '../../widgets/charts/widget.compose.json' with { type: 'json' }

// The declaration half of the API contract: what each surface exposes
// against what its manifest declares. The call-site half (every path a
// webview writes, under a declared method) lives in
// tests/unit/api-route-guards.test.ts.
//
// The COMPARISON is single-sourced in @olivierzal/homey-kit/testing
// (`findContractBreach`); what stays here is this app's tables and the
// assertions they must satisfy.
const SURFACES = [
  { api, config: appConfig, name: 'app API' },
  {
    api: ataGroupSettingApi,
    config: ataGroupSettingConfig,
    name: 'ata-group-setting widget API',
  },
  { api: chartsApi, config: chartsConfig, name: 'charts widget API' },
]

// Every surface's handler union, so the compile-time half is asserted
// once rather than per surface.
type Handler =
  | (typeof api)[keyof typeof api]
  | (typeof ataGroupSettingApi)[keyof typeof ataGroupSettingApi]
  | (typeof chartsApi)[keyof typeof chartsApi]

describe('api contract', () => {
  // Asserted on the whole union at once: no per-name method reference
  // ever leaves its object (unbound-method).
  it('should expose only function handlers', () => {
    expectTypeOf<Handler>().toBeFunction()
  })

  // The sign-in route ANSWERS a payload rather than resolving empty:
  // the library enforces a post-auth registry sync, so an accepted
  // sign-in whose refresh failed is reported in the result instead of
  // as a rejection. Pinned at the type level, where the handler and
  // the webview that destructures the answer actually meet.
  it('should declare the sign-in result the webview reads back', () => {
    expectTypeOf<
      typeof api.authenticate
    >().returns.resolves.toEqualTypeOf<AuthenticationResult>()
  })

  // One comparison per surface pins the ids ↔ handlers mapping in both
  // directions at once: a handler with no declaration and a declaration
  // with no handler both break it, and the breach names the offender.
  it.each(SURFACES)(
    '$name should declare exactly the handlers its manifest names',
    (surface) => {
      expect(findContractBreach(surface)).toBeNull()
    },
  )
})
