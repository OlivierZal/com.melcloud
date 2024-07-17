import {
  ENERGY_CAPABILITY_TAG_MAPPING_ATA,
  GET_CAPABILITY_TAGS_MAPPING_ATA,
  LIST_CAPABILITY_TAGS_MAPPING_ATA,
  SET_CAPABILITY_TAGS_MAPPING_ATA,
} from '../../types'
import BaseMELCloudDriver from '../../bases/driver'

export = class extends BaseMELCloudDriver<'Ata'> {
  public readonly energyCapabilityTagMapping = ENERGY_CAPABILITY_TAG_MAPPING_ATA

  public readonly getCapabilityTagMapping = GET_CAPABILITY_TAGS_MAPPING_ATA

  public readonly listCapabilityTagMapping = LIST_CAPABILITY_TAGS_MAPPING_ATA

  public readonly setCapabilityTagMapping = SET_CAPABILITY_TAGS_MAPPING_ATA

  protected readonly type = 'Ata'

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
