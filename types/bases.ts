export interface BaseSetCapabilities {
  readonly onoff: boolean
}

export interface BaseGetCapabilities {
  readonly measure_temperature: number
}

export interface BaseListCapabilities {
  readonly 'measure_power.wifi': number
}
