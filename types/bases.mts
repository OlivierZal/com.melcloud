export interface BaseGetCapabilities {
  readonly measure_temperature: number
}

export interface BaseListCapabilities {
  readonly measure_signal_strength: number
}

export interface BaseSetCapabilities {
  readonly onoff: boolean
}

export interface CapabilitiesOptionsValues<T extends string> {
  readonly id: T
  readonly title: LocalizedStrings
}

export interface LocalizedStrings extends Partial<Record<string, string>> {
  readonly en: string
}

export interface RangeOptions {
  readonly max: number
  readonly min: number
  readonly step?: number
  readonly units?: string
}

export type BaseSettings = Partial<Record<string, unknown>>
