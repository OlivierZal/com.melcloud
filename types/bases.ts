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

export const AUTO = {
  id: 'auto',
  title: {
    da: 'Automatisk',
    en: 'Automatic',
    es: 'Automático',
    fr: 'Automatique',
    nl: 'Automatisch',
    no: 'Automatisk',
    sv: 'Automatiskt',
  },
} as const

export const OFF = {
  id: 'off',
  title: {
    da: 'Deaktiveret',
    en: 'Off',
    es: 'Desactivado',
    fr: 'Désactivé',
    nl: 'Uit',
    no: 'Av',
    sv: 'Av',
  },
} as const
