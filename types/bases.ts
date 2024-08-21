export interface BaseSetCapabilities {
  readonly onoff: boolean
}

export interface BaseGetCapabilities {
  readonly measure_temperature: number
}

export interface BaseListCapabilities {
  readonly 'measure_power.wifi': number
}

export interface RangeOptions {
  readonly max: number
  readonly min: number
  readonly step: number
}

export const AUTO = {
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
} as const
export const BY_PASS = {
  id: 'bypass',
  title: {
    da: 'Bypass',
    en: 'Bypass',
    es: 'Bypass',
    fr: 'Bypass',
    nl: 'Bypass',
    no: 'Bypass',
    sv: 'Bypass',
  },
} as const
export const COOL = {
  id: 'cool',
  title: {
    da: 'Køl ned',
    en: 'Cool',
    es: 'Enfriar',
    fr: 'Refroidir',
    nl: 'Koelen',
    no: 'Avkjøle',
    sv: 'Kyla',
  },
} as const
export const CURVE = {
  id: 'curve',
  title: {
    da: 'Varmekurve',
    en: 'Weather compensation curve',
    es: 'Curva de compensación climática',
    fr: 'Courbe de compensation météo',
    nl: 'Weerscompensatiecurve',
    no: 'Varmekurve',
    sv: 'Värmekurva',
  },
} as const
export const DRY = {
  id: 'dry',
  title: {
    da: 'Affugte',
    en: 'Dry',
    es: 'Deshumidificar',
    fr: 'Déshumidifier',
    nl: 'Ontvochtigen',
    no: 'Avfukte',
    sv: 'Avfukta',
  },
} as const
export const FAN = {
  id: 'fan',
  title: {
    da: 'Blæse',
    en: 'Fan',
    es: 'Ventilar',
    fr: 'Ventiler',
    nl: 'Ventileren',
    no: 'Vifte',
    sv: 'Fläkta',
  },
} as const
export const FLOW = {
  id: 'flow',
  title: {
    da: 'Fast fremledningstemperatur',
    en: 'Fixed flow temperature',
    es: 'Temperatura de flujo fija',
    fr: 'Température de flux fixe',
    nl: 'Vaste aanvoertemperatuur',
    no: 'Fast fremløpstemperatur',
    sv: 'Fast framledningstemperatur',
  },
} as const
export const HEAT = {
  id: 'heat',
  title: {
    da: 'Opvarm',
    en: 'Heat',
    es: 'Calentar',
    fr: 'Chauffer',
    nl: 'Verhitten',
    no: 'Varme',
    sv: 'Värme',
  },
} as const
export const OFF = {
  id: 'off',
  title: {
    da: 'Deaktiveret',
    en: 'Off',
    es: 'Desactivado',
    fr: 'Désactivé',
    nl: 'Uit',
    no: 'Av',
    sv: 'Av',
  },
} as const
export const RECOVERY = {
  id: 'recovery',
  title: {
    da: 'Varmegenvinding',
    en: 'Energy Recovery',
    es: 'Recuperación de energía',
    fr: "Récupération d'énergie",
    nl: 'Warmteterugwinning',
    no: 'Varmegjenvinning',
    sv: 'Värmeåtervinning',
  },
} as const
export const ROOM = {
  id: 'room',
  title: {
    da: 'Indendørs føler',
    en: 'Indoor temperature',
    es: 'Temperatura interior',
    fr: 'Température intérieure',
    nl: 'Binnentemperatuur',
    no: 'Innendørs føler',
    sv: 'Inomhusgivare',
  },
} as const

export const COOL_SUFFIX = {
  id: 'cool',
  title: {
    da: 'køling',
    en: 'cooling',
    es: 'enfriamiento',
    fr: 'refroidissement',
    nl: 'koeling',
    no: 'kjøling',
    sv: 'kylning',
  },
} as const
const createCoolObject = ({
  id,
  title,
}: {
  id: 'flow' | 'room'
  title: Record<string, string>
}) =>
  ({
    id: `${id}_${COOL_SUFFIX.id}`,
    title: Object.fromEntries(
      Object.entries(COOL_SUFFIX.title).map(([language, suffix]) => [
        language,
        `${title[language]} - ${suffix}`,
      ]),
    ),
  }) as const
export const FLOW_COOL = createCoolObject(FLOW)
export const ROOM_COOL = createCoolObject(ROOM)
