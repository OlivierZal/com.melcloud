import BaseMELCloudDriver from '../../bases/driver'
import {
  energyCapabilityTagMappingAta,
  getCapabilitiesOptionsAtaErv,
  getCapabilityTagMappingAta,
  listCapabilityTagMappingAta,
  setCapabilityTagMappingAta,
} from '../../types'

export = class extends BaseMELCloudDriver<'Ata'> {
  public readonly energyCapabilityTagMapping = energyCapabilityTagMappingAta

  public readonly getCapabilitiesOptions = getCapabilitiesOptionsAtaErv

  public readonly getCapabilityTagMapping = getCapabilityTagMappingAta

  public readonly listCapabilityTagMapping = listCapabilityTagMappingAta

  public readonly setCapabilityTagMapping = setCapabilityTagMappingAta

  public readonly type = 'Ata'

  public getRequiredCapabilities(): string[] {
    return [
      ...Object.keys({
        ...this.setCapabilityTagMapping,
        ...this.getCapabilityTagMapping,
        ...this.listCapabilityTagMapping,
      }).filter((capability) => capability !== 'measure_signal_strength'),
    ]
  }
}
