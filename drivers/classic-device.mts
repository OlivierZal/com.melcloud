import type * as Classic from '@olivierzal/melcloud-api/classic'
import { fireAndForget } from '@olivierzal/homey-kit'

import type {
  Capabilities,
  CapabilitiesOptions,
  ConvertFromDevice,
  ConvertToDevice,
  OperationalCapabilities,
  OperationalCapabilityTagEntry,
  SetCapabilities,
} from '../types/classic-capabilities.mts'
import type { Settings } from '../types/device-settings.mts'
import type { ClassicMELCloudDriver } from './classic-driver.mts'
import { BaseMELCloudDevice } from './base-device.mts'

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

  protected override readonly api = 'classic'

  // An emptied Classic account is the move to MELCloud Home (see
  // `emptyAccountReason`).
  protected override readonly emptyAccountReason = 'classicAccountEmpty'

  // A stale unit is one whose last-communication timestamp has aged out.
  protected override readonly unreachableWarning = 'errors.unitStale'

  get #capabilityTagEntries(): OperationalCapabilityTagEntry<T>[] {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing shared [string, string][] to typed entries
    return this
      .operationalCapabilityTagEntries as OperationalCapabilityTagEntry<T>[]
  }

  get #data(): Readonly<Classic.ListDeviceData<T>> | undefined {
    return this.cachedFacade?.data
  }

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

  // The listing holds one tag per capability; a tag the listing lacks has
  // no value to read.
  protected override getSyncedCapabilityValue(
    facade: Classic.DeviceFacade<T>,
    capability: string,
  ): unknown {
    const { data } = facade
    const entry = this.#capabilityTagEntries.find(
      ([entryCapability, tag]) =>
        entryCapability === capability && Object.hasOwn(data, tag),
    )
    return entry === undefined
      ? undefined
      : this.#convertFromDevice(...entry, data)
  }

  protected async setCapabilityValues(
    data: Readonly<Classic.ListDeviceData<T>>,
  ): Promise<void> {
    fireAndForget(
      this.homey.api.realtime('deviceupdate', null),
      this,
      'Device update push failed:',
    )
    await Promise.all(
      this.#capabilityTagEntries.map(async ([capability, tag]) => {
        if (Object.hasOwn(data, tag)) {
          await this.setSyncedCapabilityValue(
            capability,
            this.#convertFromDevice(capability, tag, data),
          )
        }
      }),
    )
  }

  protected override async syncCapabilityValues(
    facade: Classic.DeviceFacade<T>,
  ): Promise<void> {
    await this.setCapabilityValues(facade.data)
  }

  #convertFromDevice<TKey extends keyof Capabilities<T>>(
    capability: TKey,
    tag: keyof Classic.ListDeviceData<T>,
    data: Readonly<Classic.ListDeviceData<T>>,
  ): Capabilities<T>[TKey] {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- raw tag values and union-returning converters narrow to the capability's type
    return (this.deviceToCapability[capability]?.(data) ??
      data[tag]) as Capabilities<T>[TKey]
  }
}
