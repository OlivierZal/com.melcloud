import { BaseEnergyReport } from '../../bases/report.mjs'

export abstract class BaseEnergyReportAtw extends BaseEnergyReport<'Atw'> {
  protected readonly minus = { days: 1 }
}
