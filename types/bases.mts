import { typedFromEntries } from '../lib/typed-object.mts'

export const localizeWithAffix = (
  base: LocalizedStrings,
  affix: LocalizedStrings,
  position: 'prefix' | 'suffix',
): LocalizedStrings => ({
  ...typedFromEntries(
    Object.entries(affix).map(([language, localizedAffix]) => [
      language,
      /* v8 ignore next 2 -- both arms run (atw suffix, ata-erv prefix callers) but v8 misattributes the `??` sub-branches inside this map-callback ternary; the identical bare ternary below records both arms covered */
      position === 'prefix' ?
        `${localizedAffix ?? affix.en} ${(base[language] ?? base.en).toLowerCase()}`
      : `${base[language] ?? base.en} ${localizedAffix ?? affix.en}`,
    ]),
  ),
  en:
    position === 'prefix' ?
      `${affix.en} ${base.en.toLowerCase()}`
    : `${base.en} ${affix.en}`,
})

export interface BaseGetCapabilities {
  readonly measure_temperature: number
}

export interface BaseListCapabilities {
  readonly measure_signal_strength: number
}

export interface BaseSetCapabilities {
  readonly onoff: boolean
}

export type BaseSettings = Partial<Record<string, unknown>>

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
