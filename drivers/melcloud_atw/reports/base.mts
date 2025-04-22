import type { DeviceType } from '@olivierzal/melcloud-api'

import { BaseEnergyReport } from '../../base-report.mts'

export abstract class BaseEnergyReportAtw extends BaseEnergyReport<DeviceType.Atw> {
  protected readonly minus = { days: 1 }
}
