import * as Classic from '@olivierzal/melcloud-api/classic'

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
  typeof Classic.DeviceType.Erv
> {
  protected readonly capabilityToDevice: Partial<
    Record<
      keyof SetCapabilities<typeof Classic.DeviceType.Erv>,
      ConvertToDevice<typeof Classic.DeviceType.Erv>
    >
  > = {
    thermostat_mode: (value: keyof typeof Classic.VentilationMode) =>
      Classic.VentilationMode[value],
  }

  protected readonly deviceToCapability: Partial<
    Record<
      keyof OperationalCapabilities<typeof Classic.DeviceType.Erv>,
      ConvertFromDevice<typeof Classic.DeviceType.Erv>
    >
  > = {
    thermostat_mode: (
      value: Classic.VentilationMode,
      data: Classic.ListDeviceData<typeof Classic.DeviceType.Erv>,
    ) =>
      data.Power ? ventilationModeFromDevice[value] : ThermostatModeErv.off,
  }

  protected readonly energyReportRegular = null

  protected readonly energyReportTotal = null

  protected readonly thermostatMode = ThermostatModeErv
}
