import { BaseMELCloudEnergyReportAtw } from './base'

import type { EnergyReportMode } from '../../types'

export class EnergyReportAtwRegular extends BaseMELCloudEnergyReportAtw {
  protected duration = { days: 1 }

  protected interval = { days: 1 }

  protected mode: EnergyReportMode = 'regular'

  protected values = { hour: 1, millisecond: 0, minute: 10, second: 0 }
}
