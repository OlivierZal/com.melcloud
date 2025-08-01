import type { EnergyReportMode } from '../../../types/index.mts'

import { BaseEnergyReportAtw } from './base.mts'

export class EnergyReportRegularAtw extends BaseEnergyReportAtw {
  protected duration = { days: 1 }

  protected interval = { days: 1 }

  protected mode: EnergyReportMode = 'regular'

  protected values = { hour: 1, millisecond: 0, minute: 10, second: 0 }
}
