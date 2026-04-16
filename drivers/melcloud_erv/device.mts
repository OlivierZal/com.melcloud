import {
  type ClassicDeviceType,
  type ListDeviceData,
  VentilationMode,
} from '@olivierzal/melcloud-api'

import type {
  ConvertFromDevice,
  ConvertToDevice,
  OperationalCapabilities,
  SetCapabilities,
} from '../../types/capabilities.mts'
import {
  ThermostatModeErv,
  ventilationModeFromDevice,
} from '../../types/erv.mts'
import { ClassicMELCloudDevice } from '../classic-device.mts'

export default class ClassicMELCloudDeviceErv extends ClassicMELCloudDevice<
  typeof ClassicDeviceType.Erv
> {
  protected readonly capabilityToDevice: Partial<
    Record<
      keyof SetCapabilities<typeof ClassicDeviceType.Erv>,
      ConvertToDevice<typeof ClassicDeviceType.Erv>
    >
  > = {
    thermostat_mode: (value: keyof typeof VentilationMode) =>
      VentilationMode[value],
  }

  protected readonly deviceToCapability: Partial<
    Record<
      keyof OperationalCapabilities<typeof ClassicDeviceType.Erv>,
      ConvertFromDevice<typeof ClassicDeviceType.Erv>
    >
  > = {
    thermostat_mode: (
      value: VentilationMode,
      data: ListDeviceData<typeof ClassicDeviceType.Erv>,
    ) =>
      data.Power ? ventilationModeFromDevice[value] : ThermostatModeErv.off,
  }

  protected readonly energyReportRegular = null

  protected readonly energyReportTotal = null

  protected readonly thermostatMode = ThermostatModeErv
}
