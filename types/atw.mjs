import { thermostatMode } from "../files.mjs";
import { typedFromEntries } from "../lib/index.mjs";
const addSuffixToTitle = (title, suffix) => ({
    ...typedFromEntries(Object.entries(suffix).map(([language, localizedSuffix]) => [
        language,
        /* v8 ignore next */
        `${title[language] ?? title.en} ${localizedSuffix ?? suffix.en}`,
    ])),
    en: `${title.en} ${suffix.en}`,
});
const curve = {
    id: 'curve',
    title: {
        da: 'Varmekurve',
        en: 'Weather compensation curve',
        es: 'Curva de calefacción',
        fr: 'Courbe de chauffe',
        nl: 'Weerscompensatiecurve',
        no: 'Varmekurve',
        sv: 'Värmekurva',
    },
};
const flow = {
    id: 'flow',
    title: {
        da: 'Fast fremledningstemperatur',
        en: 'Fixed flow temperature',
        es: 'Temperatura de partida fija',
        fr: 'Température de départ fixe',
        nl: 'Vaste aanvoertemperatuur',
        no: 'Fast fremløpstemperatur',
        sv: 'Fast framledningstemperatur',
    },
};
const room = {
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
};
const COOL_SUFFIX = 'cool';
const createCoolObject = ({ id, title, }) => ({
    id: `${id}_${COOL_SUFFIX}`,
    title: addSuffixToTitle(title, {
        da: '- køling',
        en: '- cooling',
        es: '- enfriamiento',
        fr: '- refroidissement',
        nl: '- koeling',
        no: '- kjøling',
        sv: '- kylning',
    }),
});
const thermostatModeTitleAtw = addSuffixToTitle(thermostatMode.title, {
    da: '- zone 2',
    en: '- zone 2',
    es: '- zona 2',
    fr: '- zone 2',
    nl: '- zone 2',
    no: '- sone 2',
    sv: '- zon 2',
});
const thermostatModeValuesAtw = [
    room,
    flow,
    curve,
    createCoolObject(room),
    createCoolObject(flow),
];
export const getCapabilitiesOptionsAtw = ({ CanCool: canCool, HasZone2: hasZone2, }) => {
    const values = canCool ?
        thermostatModeValuesAtw
        : thermostatModeValuesAtw.filter(({ id }) => !id.endsWith(COOL_SUFFIX));
    return {
        thermostat_mode: { values },
        ...(hasZone2 && {
            'thermostat_mode.zone2': { title: thermostatModeTitleAtw, values },
        }),
    };
};
export const HotWaterMode = {
    auto: 'auto',
    forced: 'forced',
};
export const HotWaterOperationState = {
    dhw: 'dhw',
    idle: 'idle',
    legionella: 'legionella',
    prohibited: 'prohibited',
};
export const ZoneOperationState = {
    cooling: 'cooling',
    defrost: 'defrost',
    heating: 'heating',
    idle: 'idle',
    prohibited: 'prohibited',
};
export const setCapabilityTagMappingAtw = {
    hot_water_mode: 'ForcedHotWaterMode',
    onoff: 'Power',
    target_temperature: 'SetTemperatureZone1',
    'target_temperature.flow_cool': 'SetCoolFlowTemperatureZone1',
    'target_temperature.flow_cool_zone2': 'SetCoolFlowTemperatureZone2',
    'target_temperature.flow_heat': 'SetHeatFlowTemperatureZone1',
    'target_temperature.flow_heat_zone2': 'SetHeatFlowTemperatureZone2',
    'target_temperature.tank_water': 'SetTankWaterTemperature',
    'target_temperature.zone2': 'SetTemperatureZone2',
    thermostat_mode: 'OperationModeZone1',
    'thermostat_mode.zone2': 'OperationModeZone2',
};
export const getCapabilityTagMappingAtw = {
    measure_temperature: 'RoomTemperatureZone1',
    'measure_temperature.outdoor': 'OutdoorTemperature',
    'measure_temperature.tank_water': 'TankWaterTemperature',
    'measure_temperature.zone2': 'RoomTemperatureZone2',
    operational_state: 'OperationMode',
};
export const listCapabilityTagMappingAtw = {
    'alarm_generic.booster_heater1': 'BoosterHeater1Status',
    'alarm_generic.booster_heater2': 'BoosterHeater2Status',
    'alarm_generic.booster_heater2_plus': 'BoosterHeater2PlusStatus',
    'alarm_generic.defrost': 'DefrostMode',
    'alarm_generic.eco_hot_water': 'EcoHotWater',
    'alarm_generic.immersion_heater': 'ImmersionHeaterStatus',
    legionella: 'LastLegionellaActivationTime',
    measure_frequency: 'HeatPumpFrequency',
    measure_power: 'CurrentEnergyConsumed',
    'measure_power.produced': 'CurrentEnergyProduced',
    measure_signal_strength: 'WifiSignalStrength',
    'measure_temperature.condensing': 'CondensingTemperature',
    'measure_temperature.flow': 'FlowTemperature',
    'measure_temperature.flow_zone1': 'FlowTemperatureZone1',
    'measure_temperature.flow_zone2': 'FlowTemperatureZone2',
    'measure_temperature.return': 'ReturnTemperature',
    'measure_temperature.return_zone1': 'ReturnTemperatureZone1',
    'measure_temperature.return_zone2': 'ReturnTemperatureZone2',
    'measure_temperature.tank_water_mixing': 'MixingTankWaterTemperature',
    'measure_temperature.target_curve': 'TargetHCTemperatureZone1',
    'measure_temperature.target_curve_zone2': 'TargetHCTemperatureZone2',
};
export const energyCapabilityTagMappingAtw = {
    meter_power: [
        'TotalCoolingConsumed',
        'TotalHeatingConsumed',
        'TotalHotWaterConsumed',
    ],
    'meter_power.cooling': ['TotalCoolingConsumed'],
    'meter_power.cop': [
        'TotalCoolingProduced',
        'TotalHeatingProduced',
        'TotalHotWaterProduced',
        'TotalCoolingConsumed',
        'TotalHeatingConsumed',
        'TotalHotWaterConsumed',
    ],
    'meter_power.cop_cooling': ['TotalCoolingProduced', 'TotalCoolingConsumed'],
    'meter_power.cop_daily': ['CoP'],
    'meter_power.cop_daily_cooling': [
        'TotalCoolingProduced',
        'TotalCoolingConsumed',
    ],
    'meter_power.cop_daily_heating': [
        'TotalHeatingProduced',
        'TotalHeatingConsumed',
    ],
    'meter_power.cop_daily_hotwater': [
        'TotalHotWaterProduced',
        'TotalHotWaterConsumed',
    ],
    'meter_power.cop_heating': ['TotalHeatingProduced', 'TotalHeatingConsumed'],
    'meter_power.cop_hotwater': [
        'TotalHotWaterProduced',
        'TotalHotWaterConsumed',
    ],
    'meter_power.daily': [
        'TotalCoolingConsumed',
        'TotalHeatingConsumed',
        'TotalHotWaterConsumed',
    ],
    'meter_power.daily_cooling': ['TotalCoolingConsumed'],
    'meter_power.daily_heating': ['TotalHeatingConsumed'],
    'meter_power.daily_hotwater': ['TotalHotWaterConsumed'],
    'meter_power.heating': ['TotalHeatingConsumed'],
    'meter_power.hotwater': ['TotalHotWaterConsumed'],
    'meter_power.produced': [
        'TotalCoolingProduced',
        'TotalHeatingProduced',
        'TotalHotWaterProduced',
    ],
    'meter_power.produced_cooling': ['TotalCoolingProduced'],
    'meter_power.produced_daily': [
        'TotalCoolingProduced',
        'TotalHeatingProduced',
        'TotalHotWaterProduced',
    ],
    'meter_power.produced_daily_cooling': ['TotalCoolingProduced'],
    'meter_power.produced_daily_heating': ['TotalHeatingProduced'],
    'meter_power.produced_daily_hotwater': ['TotalHotWaterProduced'],
    'meter_power.produced_heating': ['TotalHeatingProduced'],
    'meter_power.produced_hotwater': ['TotalHotWaterProduced'],
};
//# sourceMappingURL=atw.mjs.map