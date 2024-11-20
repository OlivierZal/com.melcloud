import { BaseEnergyReport } from '../base.mts'

import type { DeviceType } from '@olivierzal/melcloud-api'

export abstract class BaseEnergyReportAta extends BaseEnergyReport<DeviceType.Ata> {
  protected readonly minus = { hours: 1 }
}
