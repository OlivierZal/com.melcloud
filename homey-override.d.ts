import type HomeyLib from 'homey/lib/Homey.js'

import type MELCloudApp from './app.mts'
import type { Manifest } from './types/manifest.mts'
import type { MELCloudDriver } from './types/melcloud.mts'
import type { HomeySettings } from './types/settings.mts'

declare module 'homey' {
  interface Homey extends HomeyLib {
    app: MELCloudApp
    drivers: ManagerDrivers
    manifest: Manifest
    settings: ManagerSettings
  }

  interface ManagerDrivers extends HomeyLib.ManagerDrivers {
    getDriver: (driverId: string) => MELCloudDriver
    getDrivers: () => Record<string, MELCloudDriver>
  }

  interface ManagerSettings extends HomeyLib.ManagerSettings {
    get: ((key: string) => unknown) &
      (<T extends keyof HomeySettings>(key: T) => HomeySettings[T])
    set: ((key: string, value: unknown) => void) &
      (<T extends keyof HomeySettings>(key: T, value: HomeySettings[T]) => void)
  }
}

declare module 'homey/lib/Homey.js' {
  interface Homey extends HomeyLib {
    app: MELCloudApp
  }
}
