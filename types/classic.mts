import type {
  ClassicMELCloudDeviceAta,
  ClassicMELCloudDeviceAtw,
  ClassicMELCloudDeviceErv,
} from '../drivers/index.mts'

export type ClassicMELCloudDevice =
  | ClassicMELCloudDeviceAta
  | ClassicMELCloudDeviceAtw
  | ClassicMELCloudDeviceErv
