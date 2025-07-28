import { DeviceType } from '@olivierzal/melcloud-api'

import {
  energyCapabilityTagMappingAta,
  getCapabilityTagMappingAta,
  listCapabilityTagMappingAta,
  setCapabilityTagMappingAta,
} from '../../types/ata.mts'
import { getCapabilitiesOptionsAtaErv } from '../../types/common.mts'
import { BaseMELCloudDriver } from '../base-driver.mts'

export default class MELCloudDriverAta extends BaseMELCloudDriver<DeviceType.Ata> {
  public readonly energyCapabilityTagMapping = energyCapabilityTagMappingAta

  public readonly getCapabilitiesOptions = getCapabilitiesOptionsAtaErv

  public readonly getCapabilityTagMapping = getCapabilityTagMappingAta

  public readonly listCapabilityTagMapping = listCapabilityTagMappingAta

  public readonly setCapabilityTagMapping = setCapabilityTagMappingAta

  public readonly type = DeviceType.Ata

  public getRequiredCapabilities(): string[] {
    return Object.keys({
      ...this.setCapabilityTagMapping,
      ...this.getCapabilityTagMapping,
      ...this.listCapabilityTagMapping,
    }).filter((capability) => capability !== 'measure_signal_strength')
  }
}
