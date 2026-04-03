import type {
  DeviceType,
  FanSpeed,
  ListDeviceDataAta,
  ListDeviceDataErv,
  LoginCredentials,
} from '@olivierzal/melcloud-api'

import type {
  MELCloudDeviceAta,
  MELCloudDeviceAtw,
  MELCloudDeviceErv,
} from '../drivers/index.mts'
import type { FlowArgsAta } from './ata.mts'
import type { FlowArgsAtw } from './atw.mts'
import type {
  CapabilitiesOptions,
  CapabilitiesOptionsAtaErv,
} from './capabilities.mts'
import type { FlowArgsErv } from './erv.mts'
import {
  type CapabilitiesOptionsValues,
  type LocalizedStrings,
  localizeWithAffix,
} from './bases.mts'

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
): LocalizedStrings => localizeWithAffix(title, prefix, 'prefix')

const auto: CapabilitiesOptionsValues<'auto'> = {
  id: 'auto',
  title: {
    ar: 'تلقائي',
    da: 'Automatisk',
    de: 'Automatisch',
    en: 'Automatic',
    es: 'Automático',
    fr: 'Automatique',
    it: 'Automatica',
    ko: '자동',
    nl: 'Automatisch',
    no: 'Automatisk',
    pl: 'Automatyczny',
    ru: 'Автоматически',
    sv: 'Automatiskt',
  },
}

const fast: CapabilitiesOptionsValues<'fast'> = {
  id: 'fast',
  title: {
    ar: 'سريع',
    da: 'Hurtig',
    de: 'Schnell',
    en: 'Fast',
    es: 'Rápido',
    fr: 'Rapide',
    it: 'Veloce',
    ko: '빠름',
    nl: 'Snel',
    no: 'Rask',
    pl: 'Szybki',
    ru: 'Быстрый',
    sv: 'Snabb',
  },
}

const moderate: CapabilitiesOptionsValues<'moderate'> = {
  id: 'moderate',
  title: {
    ar: 'معتدل',
    da: 'Moderat',
    de: 'Mäßig',
    en: 'Moderate',
    es: 'Moderado',
    fr: 'Modéré',
    it: 'Moderato',
    ko: '보통',
    nl: 'Matig',
    no: 'Moderat',
    pl: 'Umiarkowany',
    ru: 'Умеренный',
    sv: 'Måttlig',
  },
}

const slow: CapabilitiesOptionsValues<'slow'> = {
  id: 'slow',
  title: {
    ar: 'بطيء',
    da: 'Langsom',
    de: 'Langsam',
    en: 'Slow',
    es: 'Lento',
    fr: 'Lent',
    it: 'Lento',
    ko: '느림',
    nl: 'Langzaam',
    no: 'Sakte',
    pl: 'Wolny',
    ru: 'Медленный',
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
    ar: 'جداً',
    da: 'Meget',
    de: 'Sehr',
    en: 'Very',
    es: 'Muy',
    fr: 'Très',
    it: 'Molto',
    ko: '매우',
    nl: 'Zeer',
    no: 'Veldig',
    pl: 'Bardzo',
    ru: 'Очень',
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

export interface AuthAPI {
  readonly authenticate: (data?: LoginCredentials) => Promise<boolean>
  readonly isAuthenticated: () => boolean
}

export interface DeviceDetails<
  T extends DeviceType = DeviceType,
  TId extends number | string = number,
> {
  readonly capabilities: readonly string[]
  readonly capabilitiesOptions: Partial<CapabilitiesOptions<T>>
  readonly data: { readonly id: TId }
  readonly name: string
}

export interface DeviceFacade {
  readonly setValues: (data: Record<string, unknown>) => Promise<unknown>
}

export type EnergyReportMode = 'regular' | 'total'

export interface EnergyReportOperation {
  readonly handle: () => Promise<void>
  readonly unschedule: () => void
}

export type FlowArgs<T extends DeviceType> =
  T extends typeof DeviceType.Ata ? FlowArgsAta
  : T extends typeof DeviceType.Atw ? FlowArgsAtw
  : T extends typeof DeviceType.Erv ? FlowArgsErv
  : never

export type MELCloudDevice =
  | MELCloudDeviceAta
  | MELCloudDeviceAtw
  | MELCloudDeviceErv
