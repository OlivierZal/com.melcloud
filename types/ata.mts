import * as Classic from '@olivierzal/melcloud-api/classic'

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
  [Classic.Horizontal.auto]: 'auto',
  [Classic.Horizontal.center]: 'center',
  [Classic.Horizontal.center_left]: 'center_left',
  [Classic.Horizontal.center_right]: 'center_right',
  [Classic.Horizontal.leftwards]: 'leftwards',
  [Classic.Horizontal.rightwards]: 'rightwards',
  [Classic.Horizontal.swing]: 'swing',
  [Classic.Horizontal.wide]: 'wide',
} as const satisfies Record<Classic.Horizontal, keyof typeof Classic.Horizontal>

export const operationModeFromDevice = {
  [Classic.OperationMode.auto]: 'auto',
  [Classic.OperationMode.cool]: 'cool',
  [Classic.OperationMode.dry]: 'dry',
  [Classic.OperationMode.fan]: 'fan',
  [Classic.OperationMode.heat]: 'heat',
} as const satisfies Record<
  Classic.OperationMode,
  keyof typeof Classic.OperationMode
>

export const verticalFromDevice = {
  [Classic.Vertical.auto]: 'auto',
  [Classic.Vertical.downwards]: 'downwards',
  [Classic.Vertical.mid_high]: 'mid_high',
  [Classic.Vertical.mid_low]: 'mid_low',
  [Classic.Vertical.middle]: 'middle',
  [Classic.Vertical.swing]: 'swing',
  [Classic.Vertical.upwards]: 'upwards',
} as const satisfies Record<Classic.Vertical, keyof typeof Classic.Vertical>
