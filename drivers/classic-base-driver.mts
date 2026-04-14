import type {
  ClassicAPI,
  DeviceType,
  ListDeviceData,
} from '@olivierzal/melcloud-api'

import type { ClassicMELCloudDevice } from '../types/classic.mts'
import type {
  CapabilitiesOptions,
  DeviceDetails,
  EnergyCapabilityTagMapping,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  SetCapabilityTagMapping,
} from '../types/index.mts'
import { typedEntries } from '../lib/index.mts'
import { BaseMELCloudDriver } from './base-driver.mts'

export abstract class ClassicMELCloudDriver<
  T extends DeviceType,
> extends BaseMELCloudDriver {
  declare public readonly getDevices: () => ClassicMELCloudDevice[]

  public abstract override readonly energyCapabilityTagMapping: EnergyCapabilityTagMapping<T>

  public abstract override readonly getCapabilitiesOptions: (
    data: ListDeviceData<T>,
  ) => Partial<CapabilitiesOptions<T>>

  public abstract override readonly getCapabilityTagMapping: GetCapabilityTagMapping<T>

  public abstract override readonly listCapabilityTagMapping: ListCapabilityTagMapping<T>

  public abstract override readonly setCapabilityTagMapping: SetCapabilityTagMapping<T>

  public abstract override readonly type: T

  public readonly consumedTagMapping: Partial<EnergyCapabilityTagMapping<T>> =
    {}

  public readonly producedTagMapping: Partial<EnergyCapabilityTagMapping<T>> =
    {}

  protected override get api(): ClassicAPI {
    return this.homey.app.api
  }

  public override async onInit(): Promise<void> {
    await super.onInit()
    this.#setProducedAndConsumedTagMappings()
  }

  public abstract override getRequiredCapabilities(
    data?: ListDeviceData<T>,
  ): string[]

  protected override getDeviceModels(): {
    data: ListDeviceData<T>
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
    data: ListDeviceData<T>
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
