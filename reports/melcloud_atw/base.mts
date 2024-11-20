import { BaseEnergyReport } from '../base.mts'

export abstract class BaseEnergyReportAtw extends BaseEnergyReport<'Atw'> {
  protected readonly minus = { days: 1 }
}
