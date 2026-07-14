import type * as Home from '@olivierzal/melcloud-api/home'
import {
  fanSpeedFromClassic,
  fanSpeedToClassic,
  horizontalFromClassic,
  horizontalToClassic,
  operationModeFromClassic,
  operationModeToClassic,
  verticalFromClassic,
  verticalToClassic,
} from '@olivierzal/melcloud-api'
import * as Classic from '@olivierzal/melcloud-api/classic'

/**
 * The facade slice `toClassicAtaGroupState` reads. Structural so callers and
 * tests can pass plain objects instead of a live facade.
 */
export type HomeAtaStateSource = Pick<
  Home.DeviceAtaFacade,
  | 'operationMode'
  | 'power'
  | 'setFanSpeed'
  | 'setTemperature'
  | 'vaneHorizontalDirection'
  | 'vaneVerticalDirection'
>

const isValue = <T,>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined

/**
 * The group state bans the silent fan speed; degrade it to auto, mirroring
 * the lib's own Classic→Home mapping of silent.
 */
export const toNonSilentFanSpeed = (
  speed: Classic.FanSpeed,
): Classic.NonSilentFanSpeed =>
  speed === Classic.FanSpeed.silent ? Classic.FanSpeed.auto : speed

/**
 * Projects a Home ATA facade onto the Classic group-state dialect the
 * `ata-group-setting` widget speaks (a device is a group of one).
 */
export const toClassicAtaGroupState = ({
  operationMode,
  power: isOn,
  setFanSpeed: speed,
  setTemperature: temperature,
  vaneHorizontalDirection,
  vaneVerticalDirection,
}: HomeAtaStateSource): Classic.GroupState => ({
  FanSpeed: toNonSilentFanSpeed(fanSpeedToClassic[speed]),
  OperationMode: operationModeToClassic[operationMode],
  Power: isOn,
  SetTemperature: temperature,
  VaneHorizontalDirection: horizontalToClassic[vaneHorizontalDirection],
  VaneVerticalDirection: verticalToClassic[vaneVerticalDirection],
})

/**
 * Translates a partial Classic group state into the Home update payload,
 * dropping absent keys (the widget sends deltas; nulls mean "unset" and have
 * no Home write semantics).
 */
export const toHomeAtaValues = ({
  FanSpeed: fanSpeed,
  OperationMode: operationMode,
  Power: isOn,
  SetTemperature: temperature,
  VaneHorizontalDirection: horizontal,
  VaneVerticalDirection: vertical,
}: Classic.GroupState): Home.AtaValues => ({
  ...(isValue(fanSpeed) && { setFanSpeed: fanSpeedFromClassic[fanSpeed] }),
  ...(isValue(operationMode) && {
    operationMode: operationModeFromClassic[operationMode],
  }),
  ...(isValue(isOn) && { power: isOn }),
  ...(isValue(temperature) && { setTemperature: temperature }),
  ...(isValue(horizontal) && {
    vaneHorizontalDirection: horizontalFromClassic[horizontal],
  }),
  ...(isValue(vertical) && {
    vaneVerticalDirection: verticalFromClassic[vertical],
  }),
})
