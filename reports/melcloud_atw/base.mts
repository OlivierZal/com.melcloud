import { BaseEnergyReport } from '../../bases/report.mts'

export abstract class BaseEnergyReportAtw extends BaseEnergyReport<'Atw'> {
  protected readonly minus = { days: 1 }
}
