import type {
  DeviceFacade,
  DeviceType,
  ListDeviceData,
} from '@olivierzal/melcloud-api'

import type {
  Capabilities,
  CapabilitiesOptions,
  ConvertFromDevice,
  ConvertToDevice,
  DeviceDetails,
  EnergyCapabilityTagMapping,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  OperationalCapabilities,
  OperationalCapabilityTagEntry,
  SetCapabilities,
  SetCapabilityTagMapping,
  Settings,
} from '../types/index.mts'
import { addToLogs } from '../decorators/add-to-logs.mts'
import type { BaseMELCloudDriver } from './base-driver.mts'
import { type EnergyReportConfig, EnergyReport } from './base-report.mts'
import { SharedBaseMELCloudDevice } from './shared-base-device.mts'

@addToLogs('getName()')
export abstract class BaseMELCloudDevice<
  T extends DeviceType,
> extends SharedBaseMELCloudDevice {
  #getCapabilityTagMapping: Partial<GetCapabilityTagMapping<T>> = {}

  #setCapabilityTagMapping: Partial<SetCapabilityTagMapping<T>> = {}

  protected abstract override capabilityToDevice: Partial<
    Record<keyof SetCapabilities<T>, ConvertToDevice<T>>
  >

  protected abstract override readonly deviceToCapability: Partial<
    Record<keyof OperationalCapabilities<T>, ConvertFromDevice<T>>
  >

  declare public readonly driver: BaseMELCloudDriver<T>

  declare public readonly getCapabilityOptions: <
    TKey extends string & keyof CapabilitiesOptions<T>,
  >(
    capability: TKey,
  ) => CapabilitiesOptions<T>[TKey]

  declare public readonly getCapabilityValue: <
    TKey extends string & keyof Capabilities<T>,
  >(
    capability: TKey,
  ) => Capabilities<T>[TKey]

  declare public readonly getData: () => DeviceDetails<T>['data']

  declare public readonly getSetting: <TKey extends keyof Settings>(
    setting: TKey,
  ) => NonNullable<Settings[TKey]>

  declare public readonly getSettings: () => Settings

  declare public readonly setCapabilityOptions: <
    TKey extends string & keyof CapabilitiesOptions<T>,
  >(
    capability: TKey,
    options: CapabilitiesOptions<T>[TKey] & Record<string, unknown>,
  ) => Promise<void>

  declare public readonly setCapabilityValue: <
    TKey extends string & keyof Capabilities<T>,
  >(
    capability: TKey,
    value: Capabilities<T>[TKey],
  ) => Promise<void>

  declare public readonly setSettings: (settings: Settings) => Promise<void>

  protected abstract override readonly thermostatMode: Record<
    string,
    string
  > | null

  get #data(): ListDeviceData<T> | undefined {
    return this.facade?.data
  }

  protected get facade(): DeviceFacade<T> | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing from generic base FacadeWithSetValues
    return this.cachedFacade as DeviceFacade<T> | undefined
  }

  public override cleanMapping<
    TMapping extends
      | EnergyCapabilityTagMapping<T>
      | GetCapabilityTagMapping<T>
      | ListCapabilityTagMapping<T>
      | SetCapabilityTagMapping<T>,
  >(capabilityTagMapping: TMapping): Partial<TMapping> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing generic return to typed Partial<TMapping>
    return super.cleanMapping(capabilityTagMapping) as Partial<TMapping>
  }

  public override async fetchDevice(): Promise<DeviceFacade<T> | null> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing from base FacadeWithSetValues after super call
    return (await super.fetchDevice()) as DeviceFacade<T> | null
  }

  public override async syncFromDevice(): Promise<void> {
    const data = await this.#getDeviceData()
    /* v8 ignore next -- defensive guard: data is guaranteed after fetchDevice */
    if (data) {
      await this.setCapabilityValues(data)
    }
  }

  protected override async applyCapabilitiesOptions(): Promise<void> {
    await super.applyCapabilitiesOptions(this.#data)
  }

  protected override createEnergyReport(
    config: EnergyReportConfig,
  ): EnergyReport<T> {
    return new EnergyReport(this, config)
  }

  protected override getFacade(): DeviceFacade<T> {
    return this.homey.app.getFacade('devices', this.id)
  }

  protected override getGetCapabilityTagMapping(): Record<string, string> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- widening partial typed mapping to generic Record
    return this.#getCapabilityTagMapping as Record<string, string>
  }

  protected override getListCapabilityTagMapping(): Record<string, string> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- widening partial typed mapping to generic Record
    return this.cleanMapping(this.driver.listCapabilityTagMapping) as Record<
      string,
      string
    >
  }

  protected override getRequiredCapabilities(): string[] {
    /* v8 ignore next -- defensive guard: facade is set after init */
    return this.#data ? this.driver.getRequiredCapabilities(this.#data) : []
  }

  protected override getSetCapabilityTagMapping(): Record<string, string> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- widening partial typed mapping to generic Record
    return this.#setCapabilityTagMapping as Record<string, string>
  }

  protected override async init(): Promise<void> {
    this.#setCapabilityTagMapping = this.cleanMapping(
      this.driver.setCapabilityTagMapping,
    )
    this.#getCapabilityTagMapping = this.cleanMapping(
      this.driver.getCapabilityTagMapping,
    )
    await super.init()
  }

  protected async setCapabilityValues(data: ListDeviceData<T>): Promise<void> {
    this.homey.api.realtime('deviceupdate', null)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing shared [string, string][] to typed entries
    const entries = this
      .operationalCapabilityTagEntries as OperationalCapabilityTagEntry<T>[]
    await Promise.all(
      entries.map(async ([capability, tag]) => {
        if (tag in data) {
          await this.setCapabilityValue(
            capability,
            this.#convertFromDevice(capability, data[tag], data),
          )
        }
      }),
    )
  }

  #convertFromDevice<TKey extends keyof Capabilities<T>>(
    capability: TKey,
    value: ListDeviceData<T>[keyof ListDeviceData<T>],
    data?: ListDeviceData<T>,
  ): Capabilities<T>[TKey] {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- converter output narrowed to specific capability type
    return (this.deviceToCapability[capability]?.(value, data) ??
      value) as Capabilities<T>[TKey]
  }

  async #fetchDeviceData(): Promise<ListDeviceData<T> | null> {
    try {
      const device = await this.fetchDevice()
      return device?.data ?? null
    } catch {
      await this.setWarning(this.homey.__('errors.deviceNotFound'))
      return null
    }
  }

  async #getDeviceData(): Promise<ListDeviceData<T> | null> {
    return this.#data ?? (await this.#fetchDeviceData())
  }
}
