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
/** ATA operation modes that produce cooling output (auto, cool, dry). */
export const classicCoolModes = new Set([
  ClassicOperationMode.auto,
  ClassicOperationMode.cool,
  ClassicOperationMode.dry,
])
/** ATA operation modes that produce heating output (auto, heat). */
export const classicHeatModes = new Set([
  ClassicOperationMode.auto,
  ClassicOperationMode.heat,
])
/** ATW device real-time operation state. */
export const ClassicOperationModeState = {
  cooling: 3,
  defrost: 5,
  /** Domestic hot water — the heat pump is currently heating the tank. */
  dhw: 1,
  heating: 2,
  idle: 0,
  /** Legionella prevention cycle — a periodic high-temperature sanitisation of the hot water tank. */
  legionella: 6,
}
/** ATW hot water derived operational state. */
export const ClassicOperationModeStateHotWater = {
  /** Domestic hot water — the heat pump is currently heating the tank. */
  dhw: 'dhw',
  idle: 'idle',
  /** Legionella prevention cycle — a periodic high-temperature sanitisation of the hot water tank. */
  legionella: 'legionella',
  /** Hot water production is disabled (e.g. prohibit flag set or holiday mode active). */
  prohibited: 'prohibited',
}
/** ATW zone derived operational state. */
export const ClassicOperationModeStateZone = {
  cooling: 'cooling',
  defrost: 'defrost',
  heating: 'heating',
  idle: 'idle',
  /** Zone regulation is disabled (e.g. prohibit flag set or holiday mode active). */
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
/** ATA set-temperature limits in °C (universal across all ATA models). */
export const ClassicTemperature = {
  /** Minimum target temperature when the device is in a cooling-capable mode. */
  cooling_min: 16,
  /** Maximum target temperature across all modes. */
  max: 31,
  /** Minimum target temperature in heating/auto/dry/fan modes. */
  min: 10,
}
/** ERV ventilation modes. */
export const ClassicVentilationMode = {
  auto: 2,
  /** Outside air flows straight through without passing the heat exchanger (free-cooling). */
  bypass: 1,
  /** Outside air passes through the heat exchanger to recover energy from extract air. */
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
