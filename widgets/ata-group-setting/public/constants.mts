/*
 * Domain constants mirrored from @olivierzal/melcloud-api.
 * Keep in sync with the API package — see prompt below for adding
 * a re-exportable constants module to melcloud-api.
 */

// ── Device types (from DeviceType) ──

export const DeviceType = {
  Ata: 0,
  Atw: 1,
  Erv: 3,
} as const

// ── ATA operation modes (from OperationMode) ──

export const MODE_HEAT = 1
export const MODE_DRY = 2
export const MODE_COOL = 3
export const MODE_FAN = 7
export const MODE_AUTO = 8

/** Synthetic mode for mixed heating/cooling — not in the API. */
export const MODE_MIXED = 0

export const coolModes: ReadonlySet<number> = new Set([
  MODE_AUTO,
  MODE_COOL,
  MODE_DRY,
])

export const heatModes: ReadonlySet<number> = new Set([MODE_AUTO, MODE_HEAT])

// ── Fan speed levels (from FanSpeed) ──

export const FanSpeed = {
  moderate: 3,
  veryFast: 5,
  verySlow: 1,
} as const

// ── ATA temperature limits ──

export const Temperature = {
  coolingMin: 16,
  max: 31,
  min: 10,
} as const
