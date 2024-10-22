import { BaseEnergyReport } from '../../bases/index.mjs'

export abstract class BaseEnergyReportAta extends BaseEnergyReport<'Ata'> {
  protected readonly minus = { hours: 1 }
}
