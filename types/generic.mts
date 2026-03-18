import type {
  DeviceType,
  FanSpeed,
  ListDeviceDataAta,
  ListDeviceDataErv,
} from '@olivierzal/melcloud-api'
import type { DateObjectUnits, DurationLike } from 'luxon'

import type {
  MELCloudDeviceAta,
  MELCloudDeviceAtw,
  MELCloudDeviceErv,
} from '../drivers/index.mts'

import { typedFromEntries } from '../lib/index.mts'

import type { FlowArgsAta } from './ata.mts'
import type { FlowArgsAtw } from './atw.mts'
import type { CapabilitiesOptionsValues, LocalizedStrings } from './bases.mts'
import type {
  CapabilitiesOptions,
  CapabilitiesOptionsAtaErv,
} from './capabilities.mts'
import type { FlowArgsErv } from './erv.mts'

export const getCapabilitiesOptionsAtaErv = ({
  HasAutomaticFanSpeed: hasAutomaticFanSpeed,
  NumberOfFanSpeeds: max,
}:
  | ListDeviceDataAta
  | ListDeviceDataErv): Partial<CapabilitiesOptionsAtaErv> => ({
  fan_speed: { max, min: Number(!hasAutomaticFanSpeed), step: 1, units: '' },
})

const addPrefixToTitle = (
  title: LocalizedStrings,
  prefix: LocalizedStrings,
): LocalizedStrings => ({
  ...typedFromEntries(
    Object.entries(prefix).map(([language, localizedPrefix]) => [
      language,
      /* v8 ignore next */
      `${localizedPrefix ?? prefix.en} ${(title[language] ?? title.en).toLowerCase()}`,
    ]),
  ),
  en: `${prefix.en} ${title.en.toLowerCase()}`,
})

const auto: CapabilitiesOptionsValues<'auto'> = {
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
}

const fast: CapabilitiesOptionsValues<'fast'> = {
  id: 'fast',
  title: {
    da: 'Hurtig',
    en: 'Fast',
    es: 'Rápido',
    fr: 'Rapide',
    nl: 'Snel',
    no: 'Rask',
    sv: 'Snabb',
  },
}

const moderate: CapabilitiesOptionsValues<'moderate'> = {
  id: 'moderate',
  title: {
    da: 'Moderat',
    en: 'Moderate',
    es: 'Moderado',
    fr: 'Modéré',
    nl: 'Matig',
    no: 'Moderat',
    sv: 'Måttlig',
  },
}

const slow: CapabilitiesOptionsValues<'slow'> = {
  id: 'slow',
  title: {
    da: 'Langsom',
    en: 'Slow',
    es: 'Lento',
    fr: 'Lent',
    nl: 'Langzaam',
    no: 'Sakte',
    sv: 'Långsam',
  },
}

const createVeryObject = ({
  id,
  title,
}: {
  id: 'fast' | 'slow'
  title: LocalizedStrings
}): CapabilitiesOptionsValues<keyof typeof FanSpeed> => ({
  id: `very_${id}`,
  title: addPrefixToTitle(title, {
    da: 'Meget',
    en: 'Very',
    es: 'Muy',
    fr: 'Très',
    nl: 'Zeer',
    no: 'Veldig',
    sv: 'Mycket',
  }),
})

export const fanSpeedValues = [
  auto,
  createVeryObject(fast),
  fast,
  moderate,
  slow,
  createVeryObject(slow),
]

export interface DeviceDetails<T extends DeviceType> {
  readonly capabilities: readonly string[]
  readonly capabilitiesOptions: Partial<CapabilitiesOptions<T>>
  readonly data: { readonly id: number }
  readonly name: string
}

export type EnergyReportMode = 'regular' | 'total'

export type FlowArgs<T extends DeviceType> =
  T extends typeof DeviceType.Ata ? FlowArgsAta
  : T extends typeof DeviceType.Atw ? FlowArgsAtw
  : T extends typeof DeviceType.Erv ? FlowArgsErv
  : never

export type MELCloudDevice =
  | MELCloudDeviceAta
  | MELCloudDeviceAtw
  | MELCloudDeviceErv

export interface ReportPlanParameters {
  readonly duration: DurationLike
  readonly interval: DurationLike
  readonly minus: DurationLike
  readonly values: DateObjectUnits
}
