import { DeviceType } from '@olivierzal/melcloud-api';
import { energyCapabilityTagMappingAtw, getCapabilitiesOptionsAtw, getCapabilityTagMappingAtw, listCapabilityTagMappingAtw, setCapabilityTagMappingAtw, } from "../../types/index.mjs";
import { BaseMELCloudDriver } from "../base-driver.mjs";
export default class MELCloudDriverAtw extends BaseMELCloudDriver {
    energyCapabilityTagMapping = energyCapabilityTagMappingAtw;
    getCapabilitiesOptions = getCapabilitiesOptionsAtw;
    getCapabilityTagMapping = getCapabilityTagMappingAtw;
    listCapabilityTagMapping = listCapabilityTagMappingAtw;
    setCapabilityTagMapping = setCapabilityTagMappingAtw;
    type = DeviceType.Atw;
    #zone1Capabilities = [
        'onoff',
        'hot_water_mode',
        'measure_temperature',
        'measure_temperature.outdoor',
        'measure_temperature.flow',
        'measure_temperature.return',
        'measure_temperature.tank_water',
        'target_temperature',
        'target_temperature.tank_water',
        'target_temperature.flow_heat',
        'thermostat_mode',
        'operational_state',
        'operational_state.hot_water',
        'operational_state.zone1',
        'measure_frequency',
        'measure_power',
        'measure_power.produced',
    ];
    #zone1CoolCapabilities = ['target_temperature.flow_cool'];
    #zone2Capabilities = [
        'measure_temperature.zone2',
        'target_temperature.zone2',
        'target_temperature.flow_heat_zone2',
        'thermostat_mode.zone2',
        'operational_state.zone2',
    ];
    #zone2CoolCapabilities = ['target_temperature.flow_cool_zone2'];
    getRequiredCapabilities({ CanCool: canCool, HasZone2: hasZone2, }) {
        return [
            ...this.#zone1Capabilities,
            ...(canCool ? this.#zone1CoolCapabilities : []),
            ...(hasZone2 ?
                [
                    ...this.#zone2Capabilities,
                    ...(canCool ? this.#zone2CoolCapabilities : []),
                ]
                : []),
        ];
    }
}
//# sourceMappingURL=driver.mjs.map