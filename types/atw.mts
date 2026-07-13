import type * as Classic from '@olivierzal/melcloud-api/classic'

import { thermostatMode } from '../files.mts'
import {
  type CapabilitiesOptionsValues,
  type LocalizedStrings,
  localizeWithAffix,
} from './bases.mts'

export const HotWaterMode = {
  auto: 'auto',
  forced: 'forced',
} as const

export type HotWaterMode = (typeof HotWaterMode)[keyof typeof HotWaterMode]

const addSuffixToTitle = (
  title: LocalizedStrings,
  suffix: LocalizedStrings,
): LocalizedStrings => localizeWithAffix(title, suffix, 'suffix')

const curve: CapabilitiesOptionsValues<'curve'> = {
  id: 'curve',
  title: {
    ar: 'منحنى التعويض المناخي',
    da: 'Varmekurve',
    de: 'Heizkurve',
    en: 'Weather compensation curve',
    es: 'Curva de calefacción',
    fr: 'Courbe de chauffe',
    it: 'Curva di compensazione climatica',
    ko: '기상 보상 곡선',
    nl: 'Weerscompensatiecurve',
    no: 'Varmekurve',
    pl: 'Krzywa kompensacji pogodowej',
    ru: 'Кривая погодозависимого регулирования',
    sv: 'Värmekurva',
  },
}

const flow: CapabilitiesOptionsValues<'flow'> = {
  id: 'flow',
  title: {
    ar: 'درجة حرارة تدفق ثابتة',
    da: 'Fast fremledningstemperatur',
    de: 'Feste Vorlauftemperatur',
    en: 'Fixed flow temperature',
    es: 'Temperatura de partida fija',
    fr: 'Température de départ fixe',
    it: 'Temperatura di mandata fissa',
    ko: '고정 유량 온도',
    nl: 'Vaste aanvoertemperatuur',
    no: 'Fast fremløpstemperatur',
    pl: 'Stała temperatura zasilania',
    ru: 'Фиксированная температура подачи',
    sv: 'Fast framledningstemperatur',
  },
}

const room: CapabilitiesOptionsValues<'room'> = {
  id: 'room',
  title: {
    ar: 'درجة الحرارة الداخلية',
    da: 'Indendørs føler',
    de: 'Innentemperatur',
    en: 'Indoor temperature',
    es: 'Temperatura interior',
    fr: 'Température intérieure',
    it: 'Temperatura interna',
    ko: '실내 온도',
    nl: 'Binnentemperatuur',
    no: 'Innendørs føler',
    pl: 'Temperatura wewnętrzna',
    ru: 'Температура в помещении',
    sv: 'Inomhusgivare',
  },
}

const COOL_SUFFIX = 'cool'

const createCoolObject = ({
  id,
  title,
}: {
  id: 'flow' | 'room'
  title: LocalizedStrings
}): CapabilitiesOptionsValues<keyof typeof Classic.OperationModeZone> => ({
  id: `${id}_${COOL_SUFFIX}`,
  title: addSuffixToTitle(title, {
    ar: '- تبريد',
    da: '- køling',
    de: '- Kühlung',
    en: '- cooling',
    es: '- enfriamiento',
    fr: '- refroidissement',
    it: '- raffrescamento',
    ko: '- 냉방',
    nl: '- koeling',
    no: '- kjøling',
    pl: '- chłodzenie',
    ru: '- охлаждение',
    sv: '- kylning',
  }),
})

const thermostatModeValuesAtw = [
  room,
  flow,
  curve,
  createCoolObject(room),
  createCoolObject(flow),
]

export const getThermostatModeValuesAtw = (
  canCool: boolean,
): CapabilitiesOptionsValues<keyof typeof Classic.OperationModeZone>[] =>
  canCool ?
    thermostatModeValuesAtw
  : thermostatModeValuesAtw.filter(({ id }) => !id.endsWith(COOL_SUFFIX))

export const thermostatModeZone2TitleAtw: LocalizedStrings = addSuffixToTitle(
  thermostatMode.title,
  {
    ar: '- المنطقة 2',
    da: '- zone 2',
    de: '- Zone 2',
    en: '- zone 2',
    es: '- zona 2',
    fr: '- zone 2',
    it: '- zona 2',
    ko: '- 구역 2',
    nl: '- zone 2',
    no: '- sone 2',
    pl: '- strefa 2',
    ru: '- зона 2',
    sv: '- zon 2',
  },
)
