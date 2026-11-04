import type { TypedManagerDrivers } from '@olivierzal/homey-kit/types'
import type { Homey } from 'homey'
import type SdkManagerDrivers from 'homey/manager/drivers'

import type { MELCloudDriver } from './melcloud.mts'

// The SDK's driver manager, its read narrowed to this app's driver
// classes; the base supplies everything else.
export interface ManagerDrivers extends SdkManagerDrivers {
  readonly getDrivers: TypedManagerDrivers<MELCloudDriver>['getDrivers']
}

// The Homey instance as this app sees it: `app` is typed by the SDK's
// `HomeyTypes` seam (`homey-override.d.ts`), `drivers` by the interface
// above. Only the app class re-declares `homey` with it — a driver or a
// device reaches the app through `homey.app`, which the seam types
// everywhere.
export interface MELCloudHomey extends Homey {
  readonly drivers: ManagerDrivers
}
