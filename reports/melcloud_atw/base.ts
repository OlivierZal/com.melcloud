import { BaseMELCloudEnergyReport } from '../../bases'

export abstract class BaseMELCloudEnergyReportAtw extends BaseMELCloudEnergyReport<'Atw'> {
  protected readonly minus = { days: 1 }
}
