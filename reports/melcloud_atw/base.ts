import { BaseEnergyReport } from '../../bases'

export abstract class BaseEnergyReportAtw extends BaseEnergyReport<'Atw'> {
  protected readonly minus = { days: 1 }
}
