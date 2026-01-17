import { FanSpeed, OperationMode } from '@olivierzal/melcloud-api'

export interface SmartFanConfig {
  readonly enabled: boolean
  readonly externalSensorId: string | null
  readonly manualPauseMinutes: number
  readonly mode: SmartFanMode
}

export interface SmartFanResult {
  readonly action: 'change_fan_speed' | 'none' | 'turn_off'
  readonly fanSpeed?: FanSpeed
}

export interface SmartFanState {
  lastChangeTime: number
  lastFanSpeed: FanSpeed | null
  manualOverrideUntil: number
}

export type SmartFanMode = 'aggressive' | 'economical' | 'moderate'

const DEFAULT_MANUAL_PAUSE_MINUTES = 30

// eslint-disable-next-line @typescript-eslint/naming-convention
export const DEFAULT_SMART_FAN_CONFIG: SmartFanConfig = {
  enabled: false,
  externalSensorId: null,
  manualPauseMinutes: DEFAULT_MANUAL_PAUSE_MINUTES,
  mode: 'moderate',
}

// Temperature thresholds in degrees Celsius
const AGGRESSIVE_THRESHOLD = 0.3
const ECONOMICAL_THRESHOLD_SLOW = 1
const ECONOMICAL_THRESHOLD_MODERATE = 2
const ECONOMICAL_THRESHOLD_FAST = 3
const HYSTERESIS_SECONDS = 60
const MODERATE_THRESHOLD_VERY_SLOW = 0.5
const MODERATE_THRESHOLD_SLOW = 1
const MODERATE_THRESHOLD_MODERATE = 1.5
const MODERATE_THRESHOLD_FAST = 2.5
const MS_PER_MINUTE = 60_000
const MS_PER_SECOND = 1000
const NO_TEMPERATURE_DIFF = 0
const OVERSHOOT_THRESHOLD = 1.5

const isHeatingMode = (operationMode: OperationMode): boolean =>
  operationMode === OperationMode.heat || operationMode === OperationMode.auto

const isCoolingMode = (operationMode: OperationMode): boolean =>
  operationMode === OperationMode.cool ||
  operationMode === OperationMode.dry ||
  operationMode === OperationMode.auto

const calculateAggressiveFanSpeed = (
  temporaryDiff: number,
  operationMode: OperationMode,
): FanSpeed => {
  const isHeating = isHeatingMode(operationMode)
  const isCooling = isCoolingMode(operationMode)

  /*
   * TempDiff > 0 means room is warmer than target
   * tempDiff < 0 means room is colder than target
   */

  if (isHeating && temporaryDiff < -AGGRESSIVE_THRESHOLD) {
    // Need to heat - go full speed
    return FanSpeed.very_fast
  }
  if (isCooling && temporaryDiff > AGGRESSIVE_THRESHOLD) {
    // Need to cool - go full speed
    return FanSpeed.very_fast
  }
  // Near target or reached - go to minimum
  return FanSpeed.very_slow
}

// eslint-disable-next-line max-statements
const calculateModerateFanSpeed = (
  temporaryDiff: number,
  operationMode: OperationMode,
): FanSpeed => {
  const absDiff = Math.abs(temporaryDiff)
  const isHeating = isHeatingMode(operationMode)
  const isCooling = isCoolingMode(operationMode)

  // Check if we're working in the right direction
  const isHeatingNeeded = isHeating && temporaryDiff < NO_TEMPERATURE_DIFF
  const isCoolingNeeded = isCooling && temporaryDiff > NO_TEMPERATURE_DIFF

  if (!isHeatingNeeded && !isCoolingNeeded) {
    // Near target or overshot
    return FanSpeed.very_slow
  }

  // Gradual speed based on difference
  if (absDiff <= MODERATE_THRESHOLD_VERY_SLOW) {
    return FanSpeed.very_slow
  }
  if (absDiff <= MODERATE_THRESHOLD_SLOW) {
    return FanSpeed.slow
  }
  if (absDiff <= MODERATE_THRESHOLD_MODERATE) {
    return FanSpeed.moderate
  }
  if (absDiff <= MODERATE_THRESHOLD_FAST) {
    return FanSpeed.fast
  }
  return FanSpeed.very_fast
}

// eslint-disable-next-line max-statements
const calculateEconomicalFanSpeed = (
  temporaryDiff: number,
  operationMode: OperationMode,
): FanSpeed => {
  const absDiff = Math.abs(temporaryDiff)
  const isHeating = isHeatingMode(operationMode)
  const isCooling = isCoolingMode(operationMode)

  // Check if we're working in the right direction
  const isHeatingNeeded = isHeating && temporaryDiff < NO_TEMPERATURE_DIFF
  const isCoolingNeeded = isCooling && temporaryDiff > NO_TEMPERATURE_DIFF

  if (!isHeatingNeeded && !isCoolingNeeded) {
    // Near target or overshot
    return FanSpeed.very_slow
  }

  // Very gradual speed - prioritize quiet operation
  if (absDiff <= ECONOMICAL_THRESHOLD_SLOW) {
    return FanSpeed.very_slow
  }
  if (absDiff <= ECONOMICAL_THRESHOLD_MODERATE) {
    return FanSpeed.slow
  }
  if (absDiff <= ECONOMICAL_THRESHOLD_FAST) {
    return FanSpeed.moderate
  }
  return FanSpeed.fast
}

const calculateFanSpeedForMode = (
  mode: SmartFanMode,
  temporaryDiff: number,
  operationMode: OperationMode,
): FanSpeed => {
  switch (mode) {
    case 'aggressive': {
      return calculateAggressiveFanSpeed(temporaryDiff, operationMode)
    }
    case 'economical': {
      return calculateEconomicalFanSpeed(temporaryDiff, operationMode)
    }
    case 'moderate':
    default: {
      return calculateModerateFanSpeed(temporaryDiff, operationMode)
    }
  }
}

const shouldTurnOff = (
  temporaryDiff: number,
  operationMode: OperationMode,
  currentFanSpeed: FanSpeed | null,
): boolean => {
  // Only consider turning off if we're at minimum speed
  if (currentFanSpeed !== FanSpeed.very_slow) {
    return false
  }

  const isHeating = isHeatingMode(operationMode)
  const isCooling = isCoolingMode(operationMode)

  // In heating mode, if room is significantly warmer than target, turn off
  if (isHeating && temporaryDiff > OVERSHOOT_THRESHOLD) {
    return true
  }

  // In cooling mode, if room is significantly colder than target, turn off
  if (isCooling && temporaryDiff < -OVERSHOOT_THRESHOLD) {
    return true
  }

  return false
}

// eslint-disable-next-line max-statements
export const calculateOptimalFanSpeed = ({
  currentRoomTemp,
  mode,
  operationMode,
  state,
  targetTemp,
}: {
  currentRoomTemp: number
  mode: SmartFanMode
  operationMode: OperationMode
  state: SmartFanState
  targetTemp: number
}): SmartFanResult => {
  const temporaryDiff = currentRoomTemp - targetTemp
  const now = Date.now()
  const hysteresisMs = HYSTERESIS_SECONDS * MS_PER_SECOND

  // Check if paused due to manual override
  if (now < state.manualOverrideUntil) {
    return { action: 'none' }
  }

  // Check hysteresis
  if (now - state.lastChangeTime < hysteresisMs) {
    return { action: 'none' }
  }

  // Check if we should turn off due to overshoot
  if (shouldTurnOff(temporaryDiff, operationMode, state.lastFanSpeed)) {
    return { action: 'turn_off' }
  }

  // Calculate new fan speed based on mode
  const newFanSpeed = calculateFanSpeedForMode(
    mode,
    temporaryDiff,
    operationMode,
  )

  // Only return if speed changed
  if (newFanSpeed === state.lastFanSpeed) {
    return { action: 'none' }
  }

  return { action: 'change_fan_speed', fanSpeed: newFanSpeed }
}

export const createSmartFanState = (): SmartFanState => ({
  lastChangeTime: 0,
  lastFanSpeed: null,
  manualOverrideUntil: 0,
})

export const updateSmartFanState = (
  state: SmartFanState,
  fanSpeed: FanSpeed,
): void => {
  state.lastChangeTime = Date.now()
  state.lastFanSpeed = fanSpeed
}

export const isManualOverrideActive = (state: SmartFanState): boolean =>
  Date.now() < state.manualOverrideUntil

export const setManualOverride = (
  state: SmartFanState,
  pauseMinutes: number,
): void => {
  state.manualOverrideUntil = Date.now() + pauseMinutes * MS_PER_MINUTE
  // Reset lastFanSpeed so the controller doesn't know what to expect
  state.lastFanSpeed = null
}

export const clearManualOverride = (state: SmartFanState): void => {
  state.manualOverrideUntil = 0
}

const NO_REMAINING_MINUTES = 0

export const getRemainingPauseMinutes = (state: SmartFanState): number => {
  const remaining = state.manualOverrideUntil - Date.now()
  return remaining > NO_REMAINING_MINUTES ?
      Math.ceil(remaining / MS_PER_MINUTE)
    : NO_REMAINING_MINUTES
}
