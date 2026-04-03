import type { DeviceType, ListDeviceData } from '@olivierzal/melcloud-api'

import type {
  Capabilities,
  CapabilitiesOptions,
  DeviceDetails,
  EnergyCapabilityTagMapping,
  FlowArgs,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  MELCloudDevice,
  OperationalCapabilities,
  SetCapabilities,
  SetCapabilityTagMapping,
} from '../types/index.mts'
import { typedEntries, typedKeys } from '../lib/index.mts'
import { SharedBaseMELCloudDriver } from './shared-base-driver.mts'

const getArg = <T extends DeviceType>(
  capability: string & keyof OperationalCapabilities<T>,
): keyof FlowArgs<T> => {
  const [arg] = capability.split('.')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- capability prefix maps to a known FlowArgs key
  return arg as keyof FlowArgs<T>
}

const tryRegisterFlowCard = (register: () => void): void => {
  try {
    register()
  } catch {
    // Flow card may not exist for this capability
  }
}

export abstract class BaseMELCloudDriver<
  T extends DeviceType,
> extends SharedBaseMELCloudDriver {
  public readonly consumedTagMapping: Partial<EnergyCapabilityTagMapping<T>> =
    {}

  public abstract override readonly energyCapabilityTagMapping: EnergyCapabilityTagMapping<T>

  public abstract override readonly getCapabilitiesOptions: (
    data: ListDeviceData<T>,
  ) => Partial<CapabilitiesOptions<T>>

  public abstract override readonly getCapabilityTagMapping: GetCapabilityTagMapping<T>

  declare public readonly getDevices: () => MELCloudDevice[]

  public abstract override readonly listCapabilityTagMapping: ListCapabilityTagMapping<T>

  public readonly producedTagMapping: Partial<EnergyCapabilityTagMapping<T>> =
    {}

  public abstract override readonly setCapabilityTagMapping: SetCapabilityTagMapping<T>

  public abstract override readonly type: T

  protected override get api(): typeof this.homey.app.api {
    return this.homey.app.api
  }

  public override async onInit(): Promise<void> {
    this.#setProducedAndConsumedTagMappings()
    this.#registerRunListeners()
    await Promise.resolve()
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

  #registerActionRunListener(
    capability: string & keyof SetCapabilities<T>,
  ): void {
    tryRegisterFlowCard(() => {
      this.homey.flow
        .getActionCard(`${capability}_action`)
        .registerRunListener(async (args: FlowArgs<T>) => {
          await args.device.triggerCapabilityListener(
            capability,
            args[getArg(capability)],
          )
        })
    })
  }

  #registerConditionRunListener(
    capability: string & keyof OperationalCapabilities<T>,
  ): void {
    tryRegisterFlowCard(() => {
      this.homey.flow
        .getConditionCard(`${capability}_condition`)
        .registerRunListener((args: FlowArgs<T>) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing Homey method to typed device capabilities
          const getCapabilityValue = args.device.getCapabilityValue as (
            capability: keyof Capabilities<T>,
          ) => Capabilities<T>[keyof Capabilities<T>]
          const value = getCapabilityValue(capability)
          return typeof value === 'string' || typeof value === 'number' ?
              value === args[getArg(capability)]
            : value
        })
    })
  }

  #registerRunListeners(): void {
    for (const capability of typedKeys<
      string & keyof OperationalCapabilities<T>
    >({
      ...this.setCapabilityTagMapping,
      ...this.getCapabilityTagMapping,
      ...this.listCapabilityTagMapping,
    })) {
      this.#registerConditionRunListener(capability)
      if (capability in this.setCapabilityTagMapping) {
        this.#registerActionRunListener(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- guarded by `in` check above
          capability as string & keyof SetCapabilities<T>,
        )
      }
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
