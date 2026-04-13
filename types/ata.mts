import { Horizontal, OperationMode, Vertical } from '@olivierzal/melcloud-api'

export const ThermostatModeAta = {
  auto: 'auto',
  cool: 'cool',
  dry: 'dry',
  fan: 'fan',
  heat: 'heat',
  off: 'off',
} as const

export type ThermostatModeAta =
  (typeof ThermostatModeAta)[keyof typeof ThermostatModeAta]

export const horizontalFromDevice = {
  [Horizontal.auto]: 'auto',
  [Horizontal.center]: 'center',
  [Horizontal.center_left]: 'center_left',
  [Horizontal.center_right]: 'center_right',
  [Horizontal.leftwards]: 'leftwards',
  [Horizontal.rightwards]: 'rightwards',
  [Horizontal.swing]: 'swing',
  [Horizontal.wide]: 'wide',
} as const satisfies Record<Horizontal, keyof typeof Horizontal>

export const operationModeFromDevice = {
  [OperationMode.auto]: 'auto',
  [OperationMode.cool]: 'cool',
  [OperationMode.dry]: 'dry',
  [OperationMode.fan]: 'fan',
  [OperationMode.heat]: 'heat',
} as const satisfies Record<OperationMode, keyof typeof OperationMode>

export const verticalFromDevice = {
  [Vertical.auto]: 'auto',
  [Vertical.downwards]: 'downwards',
  [Vertical.mid_high]: 'mid_high',
  [Vertical.mid_low]: 'mid_low',
  [Vertical.middle]: 'middle',
  [Vertical.swing]: 'swing',
  [Vertical.upwards]: 'upwards',
} as const satisfies Record<Vertical, keyof typeof Vertical>
