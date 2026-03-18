import { VentilationMode, } from '@olivierzal/melcloud-api';
import { keyOfValue } from "../../lib/index.mjs";
import { ThermostatModeErv, } from "../../types/index.mjs";
import { BaseMELCloudDevice } from "../base-device.mjs";
export default class MELCloudDeviceErv extends BaseMELCloudDevice {
    capabilityToDevice = {
        thermostat_mode: (value) => VentilationMode[value],
    };
    deviceToCapability = {
        thermostat_mode: (value, data) => data.Power ? keyOfValue(VentilationMode, value) : ThermostatModeErv.off,
    };
    energyReportRegular = null;
    energyReportTotal = null;
    thermostatMode = ThermostatModeErv;
}
//# sourceMappingURL=device.mjs.map