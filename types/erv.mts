import * as Classic from '@olivierzal/melcloud-api/classic'

import { invertEnum } from '../lib/typed-object.mts'

export const ThermostatModeErv = {
  auto: 'auto',
  bypass: 'bypass',
  off: 'off',
  recovery: 'recovery',
} as const

export type ThermostatModeErv =
  (typeof ThermostatModeErv)[keyof typeof ThermostatModeErv]

export const ventilationModeFromDevice: Record<
  Classic.VentilationMode,
  keyof typeof Classic.VentilationMode
> = invertEnum(Classic.VentilationMode)
