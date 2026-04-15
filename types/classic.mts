import type {
  ClassicMELCloudDeviceAta,
  ClassicMELCloudDeviceAtw,
  ClassicMELCloudDeviceErv,
  ClassicMELCloudDriverAta,
  ClassicMELCloudDriverAtw,
  ClassicMELCloudDriverErv,
} from '../drivers/index.mts'

export type ClassicMELCloudDevice =
  | ClassicMELCloudDeviceAta
  | ClassicMELCloudDeviceAtw
  | ClassicMELCloudDeviceErv

export type ClassicMELCloudDriver =
  | ClassicMELCloudDriverAta
  | ClassicMELCloudDriverAtw
  | ClassicMELCloudDriverErv
