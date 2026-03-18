import { DeviceType } from '@olivierzal/melcloud-api';
import { energyCapabilityTagMappingAta, getCapabilitiesOptionsAtaErv, getCapabilityTagMappingAta, listCapabilityTagMappingAta, setCapabilityTagMappingAta, } from "../../types/index.mjs";
import { BaseMELCloudDriver } from "../base-driver.mjs";
export default class MELCloudDriverAta extends BaseMELCloudDriver {
    energyCapabilityTagMapping = energyCapabilityTagMappingAta;
    getCapabilitiesOptions = getCapabilitiesOptionsAtaErv;
    getCapabilityTagMapping = getCapabilityTagMappingAta;
    listCapabilityTagMapping = listCapabilityTagMappingAta;
    setCapabilityTagMapping = setCapabilityTagMappingAta;
    type = DeviceType.Ata;
    getRequiredCapabilities() {
        return Object.keys({
            ...this.setCapabilityTagMapping,
            ...this.getCapabilityTagMapping,
            ...this.listCapabilityTagMapping,
        }).filter((capability) => capability !== 'measure_signal_strength');
    }
}
//# sourceMappingURL=driver.mjs.map