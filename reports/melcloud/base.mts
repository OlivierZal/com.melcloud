import { BaseEnergyReport } from '../../bases/report.mjs'

export abstract class BaseEnergyReportAta extends BaseEnergyReport<'Ata'> {
  protected readonly minus = { hours: 1 }
}
