import type * as Classic from '@olivierzal/melcloud-api/classic'
import { EntityNotFoundError } from '@olivierzal/melcloud-api'

import type {
  Capabilities,
  CapabilitiesOptions,
  ConvertFromDevice,
  ConvertToDevice,
  OperationalCapabilities,
  OperationalCapabilityTagEntry,
  SetCapabilities,
} from '../types/capabilities.mts'
import type { DeviceDetails } from '../types/device.mts'
import type { Settings } from '../types/settings.mts'
import type { ClassicMELCloudDriver } from './classic-driver.mts'
import { BaseMELCloudDevice } from './base-device.mts'
import { type EnergyReportConfig, EnergyReport } from './base-report.mts'

export abstract class ClassicMELCloudDevice<
  T extends Classic.DeviceType,
> extends BaseMELCloudDevice {
  declare public readonly driver: ClassicMELCloudDriver<T>

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

  protected abstract override capabilityToDevice: Partial<
    Record<keyof SetCapabilities<T>, ConvertToDevice<T>>
  >

  protected abstract override readonly deviceToCapability: Partial<
    Record<keyof OperationalCapabilities<T>, ConvertFromDevice<T>>
  >

  protected abstract override readonly thermostatMode: Record<
    string,
    string
  > | null

  protected get facade(): Classic.DeviceFacade<T> | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing from generic base FacadeWithSetValues
    return this.cachedFacade as Classic.DeviceFacade<T> | undefined
  }

  get #data(): Readonly<Classic.ListDeviceData<T>> | undefined {
    return this.facade?.data
  }

  public override async ensureDevice(): Promise<Classic.DeviceFacade<T> | null> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing from base FacadeWithSetValues after super call
    return (await super.ensureDevice()) as Classic.DeviceFacade<T> | null
  }

  public override async syncFromDevice(): Promise<void> {
    const data = await this.#getDeviceData()
    /* v8 ignore next -- @preserve -- defensive guard: data is guaranteed after ensureDevice */
    if (!data) {
      return
    }
    await this.setCapabilityValues(data)
  }

  protected override async applyCapabilitiesOptions(): Promise<void> {
    await super.applyCapabilitiesOptions(this.#data)
  }

  protected override createEnergyReport(
    config: EnergyReportConfig,
  ): EnergyReport<T> {
    return new EnergyReport(this, config)
  }

  protected override getFacade(): Classic.DeviceFacade<T> {
    return this.homey.app.getClassicFacade('devices', this.id)
  }

  protected override getRequiredCapabilities(): string[] {
    /* v8 ignore next -- @preserve -- defensive guard: facade is set after init */
    return this.#data ? this.driver.getRequiredCapabilities(this.#data) : []
  }

  protected async setCapabilityValues(
    data: Readonly<Classic.ListDeviceData<T>>,
  ): Promise<void> {
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
    value: Classic.ListDeviceData<T>[keyof Classic.ListDeviceData<T>],
    data?: Readonly<Classic.ListDeviceData<T>>,
  ): Capabilities<T>[TKey] {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- converter output narrowed to specific capability type
    return (this.deviceToCapability[capability]?.(value, data) ??
      value) as Capabilities<T>[TKey]
  }

  async #getDeviceData(): Promise<Readonly<Classic.ListDeviceData<T>> | null> {
    try {
      if (this.#data) {
        return this.#data
      }
      const device = await this.ensureDevice()
      return device?.data ?? null
    } catch (error) {
      if (!(error instanceof EntityNotFoundError)) {
        throw error
      }
      await this.setWarning(this.homey.__('errors.deviceNotFound'))
      return null
    }
  }
}
