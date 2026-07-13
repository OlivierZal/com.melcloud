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
    thermostat_mode: ({ Power: isOn, VentilationMode: mode }) =>
      isOn ? ventilationModeFromDevice[mode] : ThermostatModeErv.off,
  }

  protected override readonly thermostatMode: typeof ThermostatModeErv =
    ThermostatModeErv
}
