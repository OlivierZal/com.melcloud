import { DeviceType, effectiveFlagsAta } from '@olivierzal/melcloud-api'
import {
  energyCapabilityTagMappingAta,
  getCapabilityTagMappingAta,
  listCapabilityTagMappingAta,
  setCapabilityTagMappingAta,
  storeMappingAta,
} from '../../types'
import BaseMELCloudDriver from '../../bases/driver'

export = class extends BaseMELCloudDriver<'Ata'> {
  public readonly effectiveFlags = effectiveFlagsAta

  public readonly energyCapabilityTagMapping = energyCapabilityTagMappingAta

  public readonly getCapabilityTagMapping = getCapabilityTagMappingAta

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
