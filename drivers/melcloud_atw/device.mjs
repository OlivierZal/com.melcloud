import { OperationModeState, OperationModeZone, } from '@olivierzal/melcloud-api';
import { DateTime } from 'luxon';
import { keyOfValue } from "../../lib/index.mjs";
import { HotWaterMode, HotWaterOperationState, ZoneOperationState, } from "../../types/index.mjs";
import { BaseMELCloudDevice } from "../base-device.mjs";
const K_MULTIPLIER = 1000;
const isKeyOfHotWaterOperationState = (key) => key in HotWaterOperationState;
const isKeyOfZoneOperationState = (key) => key in ZoneOperationState;
const convertFromDeviceMeasurePower = (value) => value * K_MULTIPLIER;
const convertFromDeviceOperationZone = (value) => keyOfValue(OperationModeZone, value);
const getOperationModeStateHotWaterValue = (data, operationModeState) => {
    if (data.ForcedHotWaterMode) {
        return HotWaterOperationState.dhw;
    }
    if (data.ProhibitHotWater) {
        return HotWaterOperationState.prohibited;
    }
    if (isKeyOfHotWaterOperationState(operationModeState)) {
        return HotWaterOperationState[operationModeState];
    }
    return HotWaterOperationState.idle;
};
const getOperationModeStateZoneValue = (data, operationModeState, zone) => {
    if ((data[`${zone}InCoolMode`] && data[`ProhibitCooling${zone}`]) ||
        (data[`${zone}InHeatMode`] && data[`ProhibitHeating${zone}`])) {
        return ZoneOperationState.prohibited;
    }
    if (isKeyOfZoneOperationState(operationModeState) && !data[`Idle${zone}`]) {
        return ZoneOperationState[operationModeState];
    }
    return ZoneOperationState.idle;
};
export default class MELCloudDeviceAtw extends BaseMELCloudDevice {
    capabilityToDevice = {
        hot_water_mode: (value) => HotWaterMode[value] === HotWaterMode.forced,
        thermostat_mode: (value) => OperationModeZone[value],
        'thermostat_mode.zone2': (value) => OperationModeZone[value],
    };
    deviceToCapability = {
        'alarm_generic.defrost': Boolean,
        measure_power: convertFromDeviceMeasurePower,
        'measure_power.produced': convertFromDeviceMeasurePower,
        'target_temperature.flow_cool': this.#convertFromDeviceTargetTemperatureFlow('target_temperature.flow_cool'),
        'target_temperature.flow_cool_zone2': this.#convertFromDeviceTargetTemperatureFlow('target_temperature.flow_cool_zone2'),
        'target_temperature.flow_heat': this.#convertFromDeviceTargetTemperatureFlow('target_temperature.flow_heat'),
        'target_temperature.flow_heat_zone2': this.#convertFromDeviceTargetTemperatureFlow('target_temperature.flow_heat_zone2'),
        thermostat_mode: convertFromDeviceOperationZone,
        'thermostat_mode.zone2': convertFromDeviceOperationZone,
        hot_water_mode: (value) => value ? HotWaterMode.forced : HotWaterMode.auto,
        legionella: (value) => DateTime.fromISO(value).toLocaleString({
            day: 'numeric',
            month: 'short',
            weekday: 'short',
        }),
        operational_state: (value) => keyOfValue(OperationModeState, value),
    };
    energyReportRegular = {
        duration: { days: 1 },
        interval: { days: 1 },
        minus: { days: 1 },
        mode: 'regular',
        values: { hour: 1, millisecond: 0, minute: 10, second: 0 },
    };
    energyReportTotal = {
        duration: { days: 1 },
        interval: { days: 1 },
        minus: { days: 1 },
        mode: 'total',
        values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
    };
    thermostatMode = null;
    async setCapabilityValues(data) {
        await super.setCapabilityValues(data);
        await this.#setOperationModeStates(data);
    }
    #convertFromDeviceTargetTemperatureFlow(capability) {
        return (value) => value || this.getCapabilityOptions(capability).min;
    }
    async #setOperationModeStateHotWater(data, operationModeState) {
        await this.setCapabilityValue('operational_state.hot_water', getOperationModeStateHotWaterValue(data, operationModeState));
    }
    async #setOperationModeStates(data) {
        const operationModeState = keyOfValue(OperationModeState, data.OperationMode);
        await this.#setOperationModeStateHotWater(data, operationModeState);
        await this.#setOperationModeStateZones(data, operationModeState);
    }
    async #setOperationModeStateZones(data, operationModeState) {
        await Promise.all(['Zone1', 'Zone2'].map(async (zone) => {
            const zoneSuffix = zone === 'Zone1' ? 'zone1' : 'zone2';
            if (this.hasCapability(`operational_state.${zoneSuffix}`)) {
                await this.setCapabilityValue(`operational_state.${zoneSuffix}`, getOperationModeStateZoneValue(data, operationModeState, zone));
            }
        }));
    }
}
//# sourceMappingURL=device.mjs.map