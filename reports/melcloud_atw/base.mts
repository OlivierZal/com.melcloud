import { BaseEnergyReport } from '../../bases/index.mjs'

export abstract class BaseEnergyReportAtw extends BaseEnergyReport<'Atw'> {
  protected readonly minus = { days: 1 }
}
