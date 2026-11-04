import type { LocalizedStrings } from '@olivierzal/homey-kit/manifest'

import type { CapabilitiesOptionsValues } from './bases.mts'

// What a driver's manifest entry narrows on the generic capability
// definition: the bounds and the offered values. The title and the type
// stay the definition's.
export type CapabilitiesOptionsNarrowing = Partial<
  Pick<ManifestDriverCapabilitiesOptions, 'max' | 'min' | 'values'>
>

// A capability's options as this app renders them: the vendored
// node-homey-lib definition, narrowed by the driver manifest.
export interface ManifestDriverCapabilitiesOptions {
  readonly title: LocalizedStrings
  readonly type: string
  // Numeric bounds as the manifest declares them: the widgets build
  // their pickers from these rather than from constants of their own.
  readonly max?: number | undefined
  readonly min?: number | undefined
  readonly step?: number | undefined
  readonly values?: readonly CapabilitiesOptionsValues<string>[] | undefined
}

const isLocalizedStrings = (value: unknown): value is LocalizedStrings =>
  typeof value === 'object' &&
  value !== null &&
  'en' in value &&
  Object.values(value).every((entry) => typeof entry === 'string')

const isOptionValue = (
  value: unknown,
): value is CapabilitiesOptionsValues<string> =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof value.id === 'string' &&
  'title' in value &&
  isLocalizedStrings(value.title)

// The SDK types a driver's `capabilitiesOptions` entries as unknown, so
// the fields this app reads off one are checked here, at the one
// boundary the manifest crosses; a field that is not what Homey's schema
// states leaves the definition's own in place.
export const toCapabilitiesOptionsNarrowing = (
  entry: unknown,
): CapabilitiesOptionsNarrowing => {
  if (typeof entry !== 'object' || entry === null) {
    return {}
  }
  return {
    ...('max' in entry && typeof entry.max === 'number' && { max: entry.max }),
    ...('min' in entry && typeof entry.min === 'number' && { min: entry.min }),
    ...('values' in entry &&
      Array.isArray(entry.values) &&
      entry.values.every(isOptionValue) && { values: entry.values }),
  }
}
