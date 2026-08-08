import type {
  TypedManagerDrivers,
  TypedManagerSettings,
} from '@olivierzal/homey-kit/types'
import type HomeyLib from 'homey/lib/Homey.js'

import type MELCloudApp from './app.mts'
import type { HomeySettings } from './types/app-settings.mts'
import type { Manifest } from './types/manifest.mts'
import type { MELCloudDriver } from './types/melcloud.mts'

declare module 'homey' {
  interface Homey extends HomeyLib {
    app: MELCloudApp
    drivers: ManagerDrivers
    manifest: Manifest
    settings: ManagerSettings
  }

  // The SDK interfaces are extended, not replaced: the kit generics
  // supply the narrowed member SIGNATURES, the base supplies everything
  // else. Extending both directly conflicts on the members they share.
  interface ManagerDrivers extends HomeyLib.ManagerDrivers {
    getDrivers: TypedManagerDrivers<MELCloudDriver>['getDrivers']
  }

  interface ManagerSettings extends HomeyLib.ManagerSettings {
    get: TypedManagerSettings<HomeySettings>['get']
    set: TypedManagerSettings<HomeySettings>['set']
    unset: TypedManagerSettings<HomeySettings>['unset']
  }
}

declare module 'homey/lib/Homey.js' {
  interface Homey extends HomeyLib {
    app: MELCloudApp
  }
}
