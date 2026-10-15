import { type LocalizedStrings, localize } from '@olivierzal/homey-kit/manifest'

import { typedFromEntries } from '../lib/typed-object.mts'

export type { LocalizedStrings } from '@olivierzal/homey-kit/manifest'

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
        localize(base, language),
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

/**
 * A function type whose parameter is checked bivariantly. Method syntax
 * is exempt from `strictFunctionTypes`, so a concrete converter may
 * narrow `value` to one member of the union its contract names — the one
 * place the app relies on that exemption, and the one directive that
 * says so. Sound at runtime: the SDK validates a capability value
 * against the manifest before the listener fires, and the base listener
 * strips the `thermostat_mode` `off` before any converter runs.
 * @template TIn - The union the contract names for the parameter.
 * @template TOut - The converter's return type.
 */
export type Bivariant<TIn, TOut> = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- method syntax is bivariant: see the doc comment above
  bivariant(value: TIn): TOut
}['bivariant']

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
export type CapabilityConverter = Bivariant<unknown, unknown>

export interface RangeOptions {
  readonly max: number
  readonly min: number
  readonly step?: number
  readonly units?: string
}
