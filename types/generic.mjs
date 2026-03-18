import { typedFromEntries } from "../lib/index.mjs";
export const getCapabilitiesOptionsAtaErv = ({ HasAutomaticFanSpeed: hasAutomaticFanSpeed, NumberOfFanSpeeds: max, }) => ({
    fan_speed: { max, min: Number(!hasAutomaticFanSpeed), step: 1, units: '' },
});
const addPrefixToTitle = (title, prefix) => ({
    ...typedFromEntries(Object.entries(prefix).map(([language, localizedPrefix]) => [
        language,
        /* v8 ignore next */
        `${localizedPrefix ?? prefix.en} ${(title[language] ?? title.en).toLowerCase()}`,
    ])),
    en: `${prefix.en} ${title.en.toLowerCase()}`,
});
const auto = {
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
};
const fast = {
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
};
const moderate = {
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
};
const slow = {
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
};
const createVeryObject = ({ id, title, }) => ({
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
});
export const fanSpeedValues = [
    auto,
    createVeryObject(fast),
    fast,
    moderate,
    slow,
    createVeryObject(slow),
];
//# sourceMappingURL=generic.mjs.map