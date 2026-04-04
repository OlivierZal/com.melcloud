import {
  type DeviceType,
  type ListDeviceData,
  VentilationMode,
} from '@olivierzal/melcloud-api'

import {
  type ConvertFromDevice,
  type ConvertToDevice,
  type OperationalCapabilities,
  type SetCapabilities,
  ThermostatModeErv,
  ventilationModeFromDevice,
} from '../../types/index.mts'
import { BaseMELCloudDevice } from '../base-device.mts'

export default class MELCloudDeviceErv extends BaseMELCloudDevice<
  typeof DeviceType.Erv
> {
  protected readonly capabilityToDevice: Partial<
    Record<
      keyof SetCapabilities<typeof DeviceType.Erv>,
      ConvertToDevice<typeof DeviceType.Erv>
    >
  > = {
    thermostat_mode: (value: keyof typeof VentilationMode) =>
      VentilationMode[value],
  }

  protected readonly deviceToCapability: Partial<
    Record<
      keyof OperationalCapabilities<typeof DeviceType.Erv>,
      ConvertFromDevice<typeof DeviceType.Erv>
    >
  > = {
    thermostat_mode: (
      value: VentilationMode,
      data: ListDeviceData<typeof DeviceType.Erv>,
    ) => (data.Power ? ventilationModeFromDevice[value] : ThermostatModeErv.off),
  }

  protected readonly energyReportRegular = null

  protected readonly energyReportTotal = null

  protected readonly thermostatMode = ThermostatModeErv
}
