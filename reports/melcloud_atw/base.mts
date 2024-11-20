import { BaseEnergyReport } from '../base.mts'

import type { DeviceType } from '@olivierzal/melcloud-api'

export abstract class BaseEnergyReportAtw extends BaseEnergyReport<DeviceType.Atw> {
  protected readonly minus = { days: 1 }
}
