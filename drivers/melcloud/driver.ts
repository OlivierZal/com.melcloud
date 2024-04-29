import { DeviceType, effectiveFlagsAta } from '../../melcloud'
import {
  getCapabilityTagMappingAta,
  listCapabilityTagMappingAta,
  reportCapabilityTagMappingAta,
  setCapabilityTagMappingAta,
  storeMappingAta,
} from '../../types'
import BaseMELCloudDriver from '../../bases/driver'

export = class AtaDriver extends BaseMELCloudDriver<'Ata'> {
  public readonly effectiveFlags = effectiveFlagsAta

  public readonly getCapabilityTagMapping = getCapabilityTagMappingAta

  public readonly listCapabilityTagMapping = listCapabilityTagMappingAta

  public readonly reportCapabilityTagMapping = reportCapabilityTagMappingAta

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
