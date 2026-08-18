import * as Classic from '@olivierzal/melcloud-api/classic'

import { invertEnum } from '../lib/typed-object.mts'

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

export const horizontalFromDevice: Record<
  Classic.Horizontal,
  keyof typeof Classic.Horizontal
> = invertEnum(Classic.Horizontal)

export const operationModeFromDevice: Record<
  Classic.OperationMode,
  keyof typeof Classic.OperationMode
> = invertEnum(Classic.OperationMode)

export const verticalFromDevice: Record<
  Classic.Vertical,
  keyof typeof Classic.Vertical
> = invertEnum(Classic.Vertical)
