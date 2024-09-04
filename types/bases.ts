export interface BaseSetCapabilities {
  readonly onoff: boolean
}

export interface BaseGetCapabilities {
  readonly measure_temperature: number
}

export interface BaseListCapabilities {
  readonly 'measure_power.wifi': number
}

export interface RangeOptions {
  readonly max: number
  readonly min: number
  readonly step: number
}

export const THERMOSTAT_MODE_TITLE = {
  da: 'Tilstand for termostat',
  en: 'Mode of the thermostat',
  es: 'Modo del termostato',
  fr: 'Mode du thermostat',
  nl: 'Modus van de thermostaat',
  no: 'Modus for termostaten',
  sv: 'Läge för termostaten',
}
