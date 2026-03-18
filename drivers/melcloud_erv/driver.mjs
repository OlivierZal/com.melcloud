import { DeviceType } from '@olivierzal/melcloud-api';
import { energyCapabilityTagMappingErv, getCapabilitiesOptionsAtaErv, getCapabilityTagMappingErv, listCapabilityTagMappingErv, setCapabilityTagMappingErv, } from "../../types/index.mjs";
import { BaseMELCloudDriver } from "../base-driver.mjs";
const measureCapabilities = new Set([
    'measure_co2',
    'measure_pm25',
    'measure_signal_strength',
]);
export default class MELCloudDriverErv extends BaseMELCloudDriver {
    energyCapabilityTagMapping = energyCapabilityTagMappingErv;
    getCapabilitiesOptions = getCapabilitiesOptionsAtaErv;
    getCapabilityTagMapping = getCapabilityTagMappingErv;
    listCapabilityTagMapping = listCapabilityTagMappingErv;
    setCapabilityTagMapping = setCapabilityTagMappingErv;
    type = DeviceType.Erv;
    getRequiredCapabilities({ HasCO2Sensor: hasCO2Sensor, HasPM25Sensor: hasPM25Sensor, }) {
        return [
            /* v8 ignore next */
            ...(this.manifest.capabilities ?? []).filter((capability) => !measureCapabilities.has(capability)),
            ...(hasCO2Sensor ? ['measure_co2'] : []),
            ...(hasPM25Sensor ? ['measure_pm25'] : []),
        ];
    }
}
//# sourceMappingURL=driver.mjs.map