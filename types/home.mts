import type {
  HomeMELCloudDeviceAta,
  HomeMELCloudDeviceAtw,
  HomeMELCloudDriverAta,
  HomeMELCloudDriverAtw,
} from '../drivers/index.mts'

export type HomeMELCloudDevice = HomeMELCloudDeviceAta | HomeMELCloudDeviceAtw

export type HomeMELCloudDriver = HomeMELCloudDriverAta | HomeMELCloudDriverAtw
