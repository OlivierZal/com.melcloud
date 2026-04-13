import { DeviceType } from '@olivierzal/melcloud-api'

import {
  classicEnergyCapabilityTagMappingAta,
  classicGetCapabilityTagMappingAta,
  classicListCapabilityTagMappingAta,
  classicSetCapabilityTagMappingAta,
  getCapabilitiesOptionsAtaErv,
} from '../../types/index.mts'
import { ClassicMELCloudDriver } from '../classic-base-driver.mts'

export default class ClassicMELCloudDriverAta extends ClassicMELCloudDriver<
  typeof DeviceType.Ata
> {
  public readonly energyCapabilityTagMapping =
    classicEnergyCapabilityTagMappingAta

  public readonly getCapabilitiesOptions = getCapabilitiesOptionsAtaErv

  public readonly getCapabilityTagMapping = classicGetCapabilityTagMappingAta

  public readonly listCapabilityTagMapping = classicListCapabilityTagMappingAta

  public readonly setCapabilityTagMapping = classicSetCapabilityTagMappingAta

  public readonly type = DeviceType.Ata

  public override getRequiredCapabilities(): string[] {
    return Object.keys({
      ...this.setCapabilityTagMapping,
      ...this.getCapabilityTagMapping,
      ...this.listCapabilityTagMapping,
    }).filter((capability) => capability !== 'measure_signal_strength')
  }
}
