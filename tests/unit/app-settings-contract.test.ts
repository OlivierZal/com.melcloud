import type {
  ClassicAPISettings,
  HomeAPISettings,
} from '@olivierzal/melcloud-api'
import { describe, expectTypeOf, it } from 'vitest'

import type { HomeySettings } from '../../types/app-settings.mts'

// Every key the library can write, under the two namespaces the app
// hands it: Classic unprefixed, Home prefixed.
type ApiSettingKey = Prefixed<keyof HomeAPISettings> | keyof ClassicAPISettings

// The Home namespace app.mts gives the library, expressed at the type
// level. `Capitalize` uppercases the first character only, which is
// exactly what #createSettingManager's prefixKey does at runtime.
type Prefixed<TKey extends string> = `home${Capitalize<TKey>}`

// The app hand-maintains HomeySettings while melcloud-api owns the key
// names, so the union drifts silently — loginBackoffUntil and its Home
// twin were written for releases without ever being declared, which
// only compiled through the permissive `(key: string) => unknown`
// overload in homey-override.d.ts. This fails at typecheck the day a
// release adds a @setting accessor.
//
// One-way on purpose: HomeySettings legitimately carries the app's own
// notifiedVersion, which the library knows nothing about.
describe('app settings contract', () => {
  it('should declare every key the library can write', () => {
    expectTypeOf<ApiSettingKey>().toExtend<keyof HomeySettings>()
  })
})
