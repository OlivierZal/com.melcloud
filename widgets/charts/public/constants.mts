/** MELCloud Classic API device type identifiers. */
export const ClassicDeviceType = {
  /** Air-to-Air (ATA) heat pump. */
  Ata: 0,
  /** Air-to-Water (ATW) heat pump. */
  Atw: 1,
  /** Energy Recovery Ventilation (ERV) unit. */
  Erv: 3,
}
/** MELCloud Home API device type identifiers, matching context response keys. */
export const HomeDeviceType = {
  /** Air-to-Air (ATA) heat pump. */
  Ata: 'airToAir',
  /** Air-to-Water (ATW) heat pump. */
  Atw: 'airToWater',
}
/** Fan speed levels for ATA and ERV devices. */
export const ClassicFanSpeed = {
  auto: 0,
  fast: 4,
  moderate: 3,
  silent: 255,
  slow: 2,
  very_fast: 5,
  very_slow: 1,
}
/** Effective flags value indicating no specific fields were changed; all data should be included. */
export const CLASSIC_FLAG_UNCHANGED = 0x0
/**
 * Synthetic operation mode for buildings with devices in different modes.
 * Not a real API value — used at the application layer for mixed-state display.
 */
export const CLASSIC_OPERATION_MODE_MIXED = 0
/** ClassicHorizontal vane positions for ATA devices. */
export const ClassicHorizontal = {
  auto: 0,
  center: 3,
  center_left: 2,
  center_right: 4,
  leftwards: 1,
  rightwards: 5,
  swing: 12,
  wide: 8,
}
/** Report axis label formatting types. */
export const ClassicLabelType = {
  day_of_week: 4,
  month: 2,
  month_of_year: 3,
  raw: 1,
  time: 0,
}
/** MELCloud supported language codes. */
export const ClassicLanguage = {
  bg: 1,
  cs: 2,
  da: 3,
  de: 4,
  el: 22,
  en: 0,
  es: 6,
  et: 5,
  fi: 17,
  fr: 7,
  hr: 23,
  hu: 11,
  hy: 8,
  it: 19,
  lt: 10,
  lv: 9,
  nl: 12,
  no: 13,
  pl: 14,
  pt: 15,
  ro: 24,
  ru: 16,
  sl: 25,
  sq: 26,
  sv: 18,
  tr: 21,
  uk: 20,
}
/** ATA device operation modes. */
export const ClassicOperationMode = {
  auto: 8,
  cool: 3,
  dry: 2,
  fan: 7,
  heat: 1,
}
/** Pre-built sets of ATA operation modes that support cooling or heating. */
export const classicCoolModes = new Set([
  ClassicOperationMode.auto,
  ClassicOperationMode.cool,
  ClassicOperationMode.dry,
])
export const classicHeatModes = new Set([
  ClassicOperationMode.auto,
  ClassicOperationMode.heat,
])
/** ATW device real-time operation state. */
export const ClassicOperationModeState = {
  cooling: 3,
  defrost: 5,
  dhw: 1,
  heating: 2,
  idle: 0,
  legionella: 6,
}
/** ATW hot water derived operational state. */
export const ClassicOperationModeStateHotWater = {
  dhw: 'dhw',
  idle: 'idle',
  legionella: 'legionella',
  prohibited: 'prohibited',
}
/** ATW zone derived operational state. */
export const ClassicOperationModeStateZone = {
  cooling: 'cooling',
  defrost: 'defrost',
  heating: 'heating',
  idle: 'idle',
  prohibited: 'prohibited',
}
/** ATW zone operation modes controlling temperature regulation strategy. */
export const ClassicOperationModeZone = {
  /** ClassicTemperature curve-based regulation. */
  curve: 2,
  /** Fixed flow temperature. */
  flow: 1,
  /** Fixed flow temperature with cooling. */
  flow_cool: 4,
  /** Room thermostat regulation. */
  room: 0,
  /** Room thermostat regulation with cooling. */
  room_cool: 3,
}
/** ATA set-temperature limits (universal across all ATA models). */
export const ClassicTemperature = {
  cooling_min: 16,
  max: 31,
  min: 10,
}
/** ERV ventilation modes. */
export const ClassicVentilationMode = {
  auto: 2,
  bypass: 1,
  recovery: 0,
}
/** ClassicVertical vane positions for ATA devices. */
export const ClassicVertical = {
  auto: 0,
  downwards: 5,
  mid_high: 2,
  mid_low: 4,
  middle: 3,
  swing: 7,
  upwards: 1,
}
