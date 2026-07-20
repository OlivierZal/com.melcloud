import type * as Classic from '@olivierzal/melcloud-api/classic'

import type {
  Capabilities,
  EnergyCapabilities,
  EnergyCapabilityTagEntry,
} from '../types/capabilities.mts'
import { KILOWATT_TO_WATT } from '../lib/constants.mts'
import { isTotalEnergyKey } from '../lib/is-total-energy-key.mts'
import { typedEntries } from '../lib/typed-object.mts'
import { unwrapResult } from '../lib/unwrap-result.mts'
import type { ClassicMELCloudDevice } from './classic-device.mts'
import type { ClassicMELCloudDriver } from './classic-driver.mts'
import {
  type EnergyReportConfig,
  ScheduledEnergyReport,
} from './base-report.mts'

// Non-finite tag values (missing field, non-numeric payload) count as 0 so a
// single bad tag cannot poison energy, power and COP capability values.
const sumTags = <T extends Classic.DeviceType>(
  data: Classic.EnergyData<T>,
  tags: readonly (keyof Classic.EnergyData<T>)[],
): number => {
  let sum = 0
  for (const tag of tags) {
    const value = Number(data[tag])
    if (Number.isFinite(value)) {
      sum += value
    }
  }
  return sum
}

export class EnergyReport<
  T extends Classic.DeviceType,
> extends ScheduledEnergyReport {
  readonly #device: ClassicMELCloudDevice<T>

  #linkedDeviceCount = 1

  private readonly driver: ClassicMELCloudDriver<T>

  get #energyCapabilityTagEntries(): EnergyCapabilityTagEntry<T>[] {
    const cleaned = this.#device.cleanMapping(this.driver.tagMappings.energy)
    return typedEntries<
      string & keyof EnergyCapabilities<T>,
      readonly (keyof Classic.EnergyData<T>)[]
    >(cleaned).filter(
      ([capability]) =>
        isTotalEnergyKey(capability) === (this.mode === 'total'),
    )
  }

  public constructor(
    device: ClassicMELCloudDevice<T>,
    config: EnergyReportConfig,
  ) {
    super(device, config)
    this.#device = device
    this.driver = device.driver
  }

  protected override async fetchAndApply(): Promise<void> {
    const device = await this.#device.ensureDevice()
    if (device === null) {
      return
    }
    // Fetch energy data from the previous period (offset by config.minus)
    const toDateTime = this.reportDateTime()
    const to = toDateTime.toPlainDate().toString()
    // Total mode reports from the epoch: omitting `from` lets the API
    // default to its full-history lower bound.
    const query = this.mode === 'total' ? { to } : { from: to, to }
    await this.#set(
      unwrapResult(await device.getEnergy(query)),
      toDateTime.hour,
    )
  }

  protected override hasEnabledCapabilities(): boolean {
    return this.#energyCapabilityTagEntries.length > 0
  }

  // COP (Coefficient of Performance) = produced energy / consumed energy.
  // Falls back to divisor of 1 to avoid division by zero when no energy consumed
  #calculateCopValue(
    data: Classic.EnergyData<T>,
    capability: string & keyof EnergyCapabilities<T>,
  ): number {
    const { consumedTagMapping, producedTagMapping } = this.driver
    const consumedTags = consumedTagMapping[capability] ?? []
    const producedTags = producedTagMapping[capability] ?? []
    const consumed = sumTags(data, consumedTags)
    return sumTags(data, producedTags) / (consumed === 0 ? 1 : consumed)
  }

  #calculateEnergyValue(
    data: Classic.EnergyData<T>,
    tags: readonly (keyof Classic.EnergyData<T>)[],
  ): number {
    return sumTags(data, tags) / this.#linkedDeviceCount
  }

  // Power values are stored as 24-element arrays (one per hour).
  // Multiply by KILOWATT_TO_WATT to convert from kW to W
  #calculatePowerValue(
    data: Classic.EnergyData<T>,
    tags: readonly (keyof Classic.EnergyData<T>)[],
    hour: number,
  ): number {
    let total = 0
    for (const tag of tags) {
      const tagData = data[tag]
      if (Array.isArray(tagData)) {
        total += (tagData[hour] ?? 0) * KILOWATT_TO_WATT
      }
    }

    return total / this.#linkedDeviceCount
  }

  // Per-capability number dispatch, so the capability-type cast in
  // `#set` lives once instead of per branch.
  #calculateValue({
    capability,
    data,
    hour,
    tags,
  }: {
    capability: string & keyof EnergyCapabilities<T>
    data: Classic.EnergyData<T>
    hour: number
    tags: readonly (keyof Classic.EnergyData<T>)[]
  }): number {
    if (capability.includes('cop')) {
      return this.#calculateCopValue(data, capability)
    }
    if (capability.startsWith('measure_power')) {
      return this.#calculatePowerValue(data, tags, hour)
    }
    return this.#calculateEnergyValue(data, tags)
  }

  async #set(data: Classic.EnergyData<T>, hour: number): Promise<void> {
    if ('UsageDisclaimerPercentages' in data) {
      this.#linkedDeviceCount =
        data.UsageDisclaimerPercentages.split(',').length
    }
    await Promise.all(
      this.#energyCapabilityTagEntries.map(
        async ([capability, tags]: [
          string & keyof EnergyCapabilities<T>,
          readonly (keyof Classic.EnergyData<T>)[],
        ]) =>
          this.#device.setCapabilityValue(
            capability,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- number result narrowed to energy capability type
            this.#calculateValue({
              capability,
              data,
              hour,
              tags,
            }) as Capabilities<T>[string & keyof EnergyCapabilities<T>],
          ),
      ),
    )
  }
}
