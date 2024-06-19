import {
  energyCapabilityTagMappingAta,
  getCapabilityTagMappingAta,
  listCapabilityTagMappingAta,
  setCapabilityTagMappingAta,
  storeMappingAta,
} from '../../types'
import BaseMELCloudDriver from '../../bases/driver'
import { DeviceType } from '@olivierzal/melcloud-api'

export = class extends BaseMELCloudDriver<'Ata'> {
  public readonly energyCapabilityTagMapping = energyCapabilityTagMappingAta

  public readonly getCapabilityTagMapping = getCapabilityTagMappingAta

  public override readonly heatPumpType = 'Ata'

  public readonly listCapabilityTagMapping = listCapabilityTagMappingAta

  public readonly setCapabilityTagMapping = setCapabilityTagMappingAta

  protected readonly deviceType = DeviceType.Ata

  protected readonly storeMapping = storeMappingAta

  public getRequiredCapabilities(): string[] {
    return [
      ...Object.keys({
        ...this.setCapabilityTagMapping,
        ...this.getCapabilityTagMapping,
        ...this.listCapabilityTagMapping,
      }).filter((capability) => capability !== 'measure_power.wifi'),
      'thermostat_mode',
    ]
  }
}
