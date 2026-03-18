import { FanSpeed, Horizontal, OperationMode, Vertical, } from '@olivierzal/melcloud-api';
import { keyOfValue } from "../../lib/index.mjs";
import { ThermostatModeAta, } from "../../types/index.mjs";
import { BaseMELCloudDevice } from "../base-device.mjs";
export default class MELCloudDeviceAta extends BaseMELCloudDevice {
    capabilityToDevice = {
        horizontal: (value) => Horizontal[value],
        thermostat_mode: (value) => OperationMode[value],
        vertical: (value) => Vertical[value],
    };
    deviceToCapability = {
        'alarm_generic.silent': (value) => value === FanSpeed.silent,
        fan_speed: (value) => value === FanSpeed.silent ? FanSpeed.auto : value,
        horizontal: (value) => keyOfValue(Horizontal, value),
        thermostat_mode: (value, data) => data.Power ? keyOfValue(OperationMode, value) : ThermostatModeAta.off,
        vertical: (value) => keyOfValue(Vertical, value),
    };
    energyReportRegular = {
        duration: { hours: 1 },
        interval: { hours: 1 },
        minus: { hours: 1 },
        mode: 'regular',
        values: { millisecond: 0, minute: 5, second: 0 },
    };
    energyReportTotal = {
        duration: { days: 1 },
        interval: { days: 1 },
        minus: { hours: 1 },
        mode: 'total',
        values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
    };
    thermostatMode = ThermostatModeAta;
}
//# sourceMappingURL=device.mjs.map