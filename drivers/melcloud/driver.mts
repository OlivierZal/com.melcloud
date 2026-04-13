import { DeviceType } from '@olivierzal/melcloud-api'

import {
  energyCapabilityTagMapping,
  getCapabilityTagMapping,
  listCapabilityTagMapping,
  setCapabilityTagMapping,
} from '../../types/classic-ata.mts'
import { getCapabilitiesOptionsAtaErv } from '../../types/index.mts'
import { ClassicMELCloudDriver } from '../classic-base-driver.mts'

export default class ClassicMELCloudDriverAta extends ClassicMELCloudDriver<
  typeof DeviceType.Ata
> {
  public readonly energyCapabilityTagMapping = energyCapabilityTagMapping

  public readonly getCapabilitiesOptions = getCapabilitiesOptionsAtaErv

  public readonly getCapabilityTagMapping = getCapabilityTagMapping

  public readonly listCapabilityTagMapping = listCapabilityTagMapping

  public readonly setCapabilityTagMapping = setCapabilityTagMapping

  public readonly type = DeviceType.Ata

  public override getRequiredCapabilities(): string[] {
    return Object.keys({
      ...this.setCapabilityTagMapping,
      ...this.getCapabilityTagMapping,
      ...this.listCapabilityTagMapping,
    }).filter((capability) => capability !== 'measure_signal_strength')
  }
}
