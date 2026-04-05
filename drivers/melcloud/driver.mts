import { DeviceType } from '@olivierzal/melcloud-api'

import {
  energyCapabilityTagMappingAta,
  getCapabilitiesOptionsAtaErv,
  getCapabilityTagMappingAta,
  listCapabilityTagMappingAta,
  setCapabilityTagMappingAta,
} from '../../types/index.mts'
import { ClassicMELCloudDriver } from '../classic-base-driver.mts'

export default class MELCloudDriverAta extends ClassicMELCloudDriver<
  typeof DeviceType.Ata
> {
  public readonly energyCapabilityTagMapping = energyCapabilityTagMappingAta

  public readonly getCapabilitiesOptions = getCapabilitiesOptionsAtaErv

  public readonly getCapabilityTagMapping = getCapabilityTagMappingAta

  public readonly listCapabilityTagMapping = listCapabilityTagMappingAta

  public readonly setCapabilityTagMapping = setCapabilityTagMappingAta

  public readonly type = DeviceType.Ata

  public override getRequiredCapabilities(): string[] {
    return Object.keys({
      ...this.setCapabilityTagMapping,
      ...this.getCapabilityTagMapping,
      ...this.listCapabilityTagMapping,
    }).filter((capability) => capability !== 'measure_signal_strength')
  }
}
