export interface BaseSetCapabilities {
  readonly onoff: boolean
}

export interface BaseGetCapabilities {
  readonly measure_temperature: number
}

export interface BaseListCapabilities {
  readonly 'measure_power.wifi': number
}

export interface LocalizedStrings extends Partial<Record<string, string>> {
  readonly en: string
}

export interface RangeOptions {
  readonly step?: number
  readonly units?: LocalizedStrings
  readonly max: number
  readonly min: number
}
