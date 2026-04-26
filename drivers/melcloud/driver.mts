import * as Classic from '@olivierzal/melcloud-api/classic'

import { getCapabilitiesOptionsAtaErv } from '../../types/ata-erv.mts'
import {
  energyCapabilityTagMapping,
  getCapabilityTagMapping,
  listCapabilityTagMapping,
  setCapabilityTagMapping,
} from '../../types/classic-ata.mts'
import { ClassicMELCloudDriver } from '../classic-driver.mts'

type AtaType = typeof Classic.DeviceType.Ata

export default class ClassicMELCloudDriverAta extends ClassicMELCloudDriver<AtaType> {
  public readonly energyCapabilityTagMapping: typeof energyCapabilityTagMapping =
    energyCapabilityTagMapping

  public readonly getCapabilitiesOptions: typeof getCapabilitiesOptionsAtaErv =
    getCapabilitiesOptionsAtaErv

  public readonly getCapabilityTagMapping: typeof getCapabilityTagMapping =
    getCapabilityTagMapping

  public readonly listCapabilityTagMapping: typeof listCapabilityTagMapping =
    listCapabilityTagMapping

  public readonly setCapabilityTagMapping: typeof setCapabilityTagMapping =
    setCapabilityTagMapping

  public readonly type: AtaType = Classic.DeviceType.Ata

  public override getRequiredCapabilities(): string[] {
    return Object.keys({
      ...this.setCapabilityTagMapping,
      ...this.getCapabilityTagMapping,
      ...this.listCapabilityTagMapping,
    }).filter((capability) => capability !== 'measure_signal_strength')
  }
}
