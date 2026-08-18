import { typedFromEntries } from '../lib/typed-object.mts'

const joinWithAffix = (
  base: string,
  affix: string,
  position: 'prefix' | 'suffix',
): string =>
  position === 'prefix' ? `${affix} ${base.toLowerCase()}` : `${base} ${affix}`

export const localizeWithAffix = (
  base: LocalizedStrings,
  affix: LocalizedStrings,
  position: 'prefix' | 'suffix',
): LocalizedStrings => ({
  ...typedFromEntries(
    Object.entries(affix).map(([language, localizedAffix]) => [
      language,
      joinWithAffix(
        base[language] ?? base.en,
        localizedAffix ?? affix.en,
        position,
      ),
    ]),
  ),
  en: joinWithAffix(base.en, affix.en, position),
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

export interface CapabilitiesOptionsAtaErv {
  readonly fan_speed: RangeOptions
}

export interface CapabilitiesOptionsValues<T extends string> {
  readonly id: T
  readonly title: LocalizedStrings
}

/**
 * Base write-converter type for capability-to-device transforms.
 */
export type CapabilityConverter = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- method syntax is bivariant, letting concrete converters narrow `value` to their capability's type
  bivariant(value: unknown): unknown
}['bivariant']

export interface LocalizedStrings extends Partial<Record<string, string>> {
  readonly en: string
}

export interface RangeOptions {
  readonly max: number
  readonly min: number
  readonly step?: number
  readonly units?: string
}
