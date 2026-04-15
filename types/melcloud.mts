import type {
  ClassicMELCloudDevice,
  ClassicMELCloudDriver,
} from './classic.mts'
import type { HomeMELCloudDevice, HomeMELCloudDriver } from './home.mts'

export type MELCloudDevice = ClassicMELCloudDevice | HomeMELCloudDevice

export type MELCloudDriver = ClassicMELCloudDriver | HomeMELCloudDriver
