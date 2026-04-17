import type * as Classic from '@olivierzal/melcloud-api/classic'

import type {
  CapabilitiesOptions,
  EnergyCapabilityTagMapping,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  SetCapabilityTagMapping,
} from '../types/capabilities.mts'
import type { ClassicMELCloudDevice } from '../types/classic.mts'
import type { DeviceDetails } from '../types/device.mts'
import { typedEntries } from '../lib/typed-object.mts'
import { BaseMELCloudDriver } from './base-driver.mts'

export abstract class ClassicMELCloudDriver<
  T extends Classic.DeviceType,
> extends BaseMELCloudDriver {
  declare public readonly getDevices: () => ClassicMELCloudDevice[]

  public abstract override readonly energyCapabilityTagMapping: EnergyCapabilityTagMapping<T>

  public abstract override readonly getCapabilitiesOptions: (
    data: Readonly<Classic.ListDeviceData<T>>,
  ) => Partial<CapabilitiesOptions<T>>

  public abstract override readonly getCapabilityTagMapping: GetCapabilityTagMapping<T>

  public abstract override readonly listCapabilityTagMapping: ListCapabilityTagMapping<T>

  public abstract override readonly setCapabilityTagMapping: SetCapabilityTagMapping<T>

  public abstract override readonly type: T

  public readonly consumedTagMapping: Partial<EnergyCapabilityTagMapping<T>> =
    {}

  public readonly producedTagMapping: Partial<EnergyCapabilityTagMapping<T>> =
    {}

  protected override get api(): Classic.API {
    return this.homey.app.classicApi
  }

  public override async onInit(): Promise<void> {
    await super.onInit()
    this.#setProducedAndConsumedTagMappings()
  }

  public abstract override getRequiredCapabilities(
    data?: Readonly<Classic.ListDeviceData<T>>,
  ): string[]

  protected override getDeviceModels(): {
    data: Readonly<Classic.ListDeviceData<T>>
    id: number
    name: string
  }[] {
    return this.homey.app.getDevicesByType(this.type)
  }

  protected override toDeviceDetails({
    data,
    id,
    name,
  }: {
    data: Readonly<Classic.ListDeviceData<T>>
    id: number
    name: string
  }): DeviceDetails<T> {
    return {
      capabilities: this.getRequiredCapabilities(data),
      capabilitiesOptions: this.getCapabilitiesOptions(data),
      data: { id },
      name,
    }
  }

  #setProducedAndConsumedTagMappings(): void {
    for (const [capability, tags] of typedEntries<
      string & keyof EnergyCapabilityTagMapping<T>,
      EnergyCapabilityTagMapping<T>[keyof EnergyCapabilityTagMapping<T>]
    >(this.energyCapabilityTagMapping)) {
      const { consumed = [], produced = [] } = Object.groupBy(tags, (tag) =>
        tag.endsWith('Consumed') ? 'consumed' : 'produced',
      )
      this.consumedTagMapping[capability] = consumed
      this.producedTagMapping[capability] = produced
    }
  }
}
