import { BaseMELCloudEnergyReport } from '../../bases'

export abstract class BaseMELCloudEnergyReportAta extends BaseMELCloudEnergyReport<'Ata'> {
  protected readonly minus = { hours: 1 }
}
