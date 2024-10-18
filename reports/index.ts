import { EnergyReportRegularAta, EnergyReportTotalAta } from './melcloud'
import { EnergyReportRegularAtw, EnergyReportTotalAtw } from './melcloud_atw'

interface EnergyReportRegular {
  readonly Ata: EnergyReportRegularAta
  readonly Atw: EnergyReportRegularAtw
  readonly Erv: never
}
interface EnergyReportTotal {
  readonly Ata: EnergyReportTotalAta
  readonly Atw: EnergyReportTotalAtw
  readonly Erv: never
}

export {
  EnergyReportRegularAta,
  EnergyReportRegularAtw,
  EnergyReportTotalAta,
  EnergyReportTotalAtw,
  type EnergyReportRegular,
  type EnergyReportTotal,
}
