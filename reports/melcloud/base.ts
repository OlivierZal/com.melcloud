import { BaseEnergyReport } from '../../bases'

export abstract class BaseEnergyReportAta extends BaseEnergyReport<'Ata'> {
  protected readonly minus = { hours: 1 }
}
