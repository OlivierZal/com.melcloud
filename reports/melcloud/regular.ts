import { BaseMELCloudEnergyReportAta } from './base'

import type { EnergyReportMode } from '../../types'

export class EnergyReportAtaRegular extends BaseMELCloudEnergyReportAta {
  protected duration = { hours: 1 }

  protected interval = { hours: 1 }

  protected mode: EnergyReportMode = 'regular'

  protected values = { millisecond: 0, minute: 5, second: 0 }
}
