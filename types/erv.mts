import * as Classic from '@olivierzal/melcloud-api/classic'

export const ThermostatModeErv = {
  auto: 'auto',
  bypass: 'bypass',
  off: 'off',
  recovery: 'recovery',
} as const

export type ThermostatModeErv =
  (typeof ThermostatModeErv)[keyof typeof ThermostatModeErv]

export const ventilationModeFromDevice = {
  [Classic.VentilationMode.auto]: 'auto',
  [Classic.VentilationMode.bypass]: 'bypass',
  [Classic.VentilationMode.recovery]: 'recovery',
} as const satisfies Record<
  Classic.VentilationMode,
  keyof typeof Classic.VentilationMode
>
