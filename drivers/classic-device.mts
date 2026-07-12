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
import type { Settings } from '../types/device-settings.mts'
import type { ClassicMELCloudDriver } from './classic-driver.mts'
import { BaseMELCloudDevice } from './base-device.mts'
import { type EnergyReportConfig, EnergyReport } from './base-report.mts'

export abstract class ClassicMELCloudDevice<
  T extends Classic.DeviceType,
> extends BaseMELCloudDevice<Classic.DeviceFacade<T>, number> {
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

  protected abstract override readonly capabilityToDevice: Partial<
    Record<keyof SetCapabilities<T>, ConvertToDevice<T>>
  >

  protected abstract readonly deviceToCapability: Partial<
    Record<keyof OperationalCapabilities<T>, ConvertFromDevice<T>>
  >

  protected get facade(): Classic.DeviceFacade<T> | undefined {
    return this.cachedFacade
  }

  get #data(): Readonly<Classic.ListDeviceData<T>> | undefined {
    return this.facade?.data
  }

  public override async syncFromDevice(): Promise<void> {
    const data = await this.#getDeviceData()
    if (data === null) {
      return
    }
    await this.setCapabilityValues(data)
  }

  protected override readonly createEnergyReport = (
    config: EnergyReportConfig,
  ): EnergyReport<T> => new EnergyReport(this, config)

  protected override getCapabilitiesOptions(): Partial<
    Record<string, unknown>
  > {
    const data = this.#data
    return data === undefined ? {} : this.driver.getCapabilitiesOptions(data)
  }

  protected override getFacade(): Classic.DeviceFacade<T> {
    return this.homey.app.getClassicFacade('devices', this.id)
  }

  protected override getRequiredCapabilities(): string[] {
    const data = this.#data
    return data === undefined ? [] : this.driver.getRequiredCapabilities(data)
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
        if (Object.hasOwn(data, tag)) {
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
      return await this.#resolveDeviceData()
    } catch (error) {
      if (!(error instanceof EntityNotFoundError)) {
        throw error
      }
      await this.setWarning(this.homey.__('errors.deviceNotFound'))
      return null
    }
  }

  async #resolveDeviceData(): Promise<Readonly<
    Classic.ListDeviceData<T>
  > | null> {
    if (this.#data !== undefined) {
      return this.#data
    }
    const device = await this.ensureDevice()
    return device?.data ?? null
  }
}
