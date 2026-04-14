import { VentilationMode } from '@olivierzal/melcloud-api'

export const ThermostatModeErv = {
  auto: 'auto',
  bypass: 'bypass',
  off: 'off',
  recovery: 'recovery',
} as const

export type ThermostatModeErv =
  (typeof ThermostatModeErv)[keyof typeof ThermostatModeErv]

export const ventilationModeFromDevice = {
  [VentilationMode.auto]: 'auto',
  [VentilationMode.bypass]: 'bypass',
  [VentilationMode.recovery]: 'recovery',
} as const satisfies Record<VentilationMode, keyof typeof VentilationMode>
