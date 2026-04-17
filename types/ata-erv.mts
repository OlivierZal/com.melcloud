import type * as Classic from '@olivierzal/melcloud-api/classic'
import type * as Home from '@olivierzal/melcloud-api/home'

import type { CapabilitiesOptionsAtaErv } from './capabilities.mts'
import {
  type CapabilitiesOptionsValues,
  type LocalizedStrings,
  localizeWithAffix,
} from './bases.mts'

const getFanSpeedOptions = (
  hasAutomaticFanSpeed: boolean,
  numberOfFanSpeeds: number,
): Partial<CapabilitiesOptionsAtaErv> => ({
  fan_speed: {
    max: numberOfFanSpeeds,
    min: Number(!hasAutomaticFanSpeed),
    step: 1,
    units: '',
  },
})

export const getCapabilitiesOptionsAtaErv = ({
  HasAutomaticFanSpeed: hasAutomaticFanSpeed,
  NumberOfFanSpeeds: numberOfFanSpeeds,
}:
  | Readonly<Classic.ListDeviceDataAta>
  | Readonly<Classic.ListDeviceDataErv>): Partial<CapabilitiesOptionsAtaErv> =>
  getFanSpeedOptions(hasAutomaticFanSpeed, numberOfFanSpeeds)

export const homeGetCapabilitiesOptions = ({
  hasAutomaticFanSpeed,
  numberOfFanSpeeds,
}: Home.DeviceCapabilities): Partial<CapabilitiesOptionsAtaErv> =>
  getFanSpeedOptions(hasAutomaticFanSpeed, numberOfFanSpeeds)

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
}): CapabilitiesOptionsValues<keyof typeof Classic.FanSpeed> => ({
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
