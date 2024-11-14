import { BaseEnergyReportAta } from './base.mts'

import type { EnergyReportMode } from '../../types/index.mts'

export class EnergyReportRegularAta extends BaseEnergyReportAta {
  protected duration = { hours: 1 }

  protected interval = { hours: 1 }

  protected mode: EnergyReportMode = 'regular'

  protected values = { millisecond: 0, minute: 5, second: 0 }
}
