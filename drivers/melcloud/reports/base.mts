import type { DeviceType } from '@olivierzal/melcloud-api'

import { BaseEnergyReport } from '../../base-report.mts'

export abstract class BaseEnergyReportAta extends BaseEnergyReport<DeviceType.Ata> {
  protected readonly minus = { hours: 1 }
}
