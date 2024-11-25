import { BaseEnergyReportAtw } from './base.mts'

import type { EnergyReportMode } from '../../../types/common.mts'

export class EnergyReportTotalAtw extends BaseEnergyReportAtw {
  protected duration = { days: 1 }

  protected interval = { days: 1 }

  protected mode: EnergyReportMode = 'total'

  protected values = { hour: 1, millisecond: 0, minute: 5, second: 0 }
}
