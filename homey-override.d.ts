import type { DeviceType } from '@olivierzal/melcloud-api'
import type HomeyLib from 'homey/lib/Homey.js'

import type MELCloudApp from './app.mts'
import type { BaseMELCloudDriver } from './drivers/base-driver.mts'
import type { HomeySettings, Manifest } from './types/index.mts'

declare module 'homey' {
  interface Homey extends HomeyLib {
    app: MELCloudApp
    drivers: ManagerDrivers
    manifest: Manifest
    settings: ManagerSettings
  }

  interface ManagerDrivers extends HomeyLib.ManagerDrivers {
    getDriver: <T extends DeviceType>(driverId: string) => BaseMELCloudDriver<T>
    getDrivers: <T extends DeviceType>() => Record<
      string,
      BaseMELCloudDriver<T>
    >
  }

  interface ManagerSettings extends HomeyLib.ManagerSettings {
    get: <T extends keyof HomeySettings>(key: T) => HomeySettings[T]
    set: <T extends keyof HomeySettings>(
      key: T,
      value: HomeySettings[T],
    ) => void
  }
}

declare module 'homey/lib/Homey.js' {
  interface Homey extends HomeyLib {
    app: MELCloudApp
  }
}
