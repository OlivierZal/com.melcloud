import { DeviceType, effectiveFlagsAta } from '../../melcloud/types'
import {
  type GetCapabilityTagMapping,
  type ListCapabilityTagMapping,
  type ReportCapabilityTagMapping,
  type SetCapabilityTagMapping,
  type StoreMapping,
  getCapabilityTagMappingAta,
  listCapabilityTagMappingAta,
  reportCapabilityTagMappingAta,
  setCapabilityTagMappingAta,
  storeMappingAta,
} from '../../types'
import BaseMELCloudDriver from '../../bases/driver'

export = class AtaDriver extends BaseMELCloudDriver<'Ata'> {
  public readonly effectiveFlags: typeof effectiveFlagsAta = effectiveFlagsAta

  public readonly getCapabilityTagMapping: GetCapabilityTagMapping['Ata'] =
    getCapabilityTagMappingAta

  public readonly listCapabilityTagMapping: ListCapabilityTagMapping['Ata'] =
    listCapabilityTagMappingAta

  public readonly reportCapabilityTagMapping: ReportCapabilityTagMapping['Ata'] =
    reportCapabilityTagMappingAta

  public readonly setCapabilityTagMapping: SetCapabilityTagMapping['Ata'] =
    setCapabilityTagMappingAta

  protected readonly deviceType: DeviceType = DeviceType.Ata

  protected readonly storeMapping: StoreMapping['Ata'] = storeMappingAta

  public getCapabilities(): string[] {
    return [
      ...Object.keys({
        ...this.setCapabilityTagMapping,
        ...this.getCapabilityTagMapping,
        ...this.listCapabilityTagMapping,
      }).filter((capability: string) => capability !== 'measure_power.wifi'),
      'thermostat_mode',
    ]
  }
}
