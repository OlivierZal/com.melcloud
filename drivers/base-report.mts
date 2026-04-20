import type * as Classic from '@olivierzal/melcloud-api/classic'
import type Homey from 'homey/lib/Homey'
import {
  type DateObjectUnits,
  type DurationLike,
  type HourNumbers,
  DateTime,
} from 'luxon'

import type {
  Capabilities,
  EnergyCapabilities,
  EnergyCapabilityTagEntry,
} from '../types/capabilities.mts'
import type { EnergyReportMode } from '../types/device.mts'
import { KILOWATT_TO_WATT } from '../lib/constants.mts'
import { isTotalEnergyKey } from '../lib/is-total-energy-key.mts'
import { typedEntries } from '../lib/typed-object.mts'
import type { ClassicMELCloudDevice } from './classic-device.mts'
import type { ClassicMELCloudDriver } from './classic-driver.mts'

const sumTags = <T extends Classic.DeviceType>(
  data: Classic.EnergyData<T>,
  tags: readonly (keyof Classic.EnergyData<T>)[],
): number =>
  tags.reduce((accumulator, tag) => accumulator + Number(data[tag]), 0)

export interface EnergyReportConfig {
  readonly duration: DurationLike
  readonly interval: DurationLike
  readonly minus: DurationLike
  readonly mode: EnergyReportMode
  readonly values: DateObjectUnits
}

export class EnergyReport<T extends Classic.DeviceType> {
  readonly #config: EnergyReportConfig

  readonly #device: ClassicMELCloudDevice<T>

  readonly #homey: Homey.Homey

  #linkedDeviceCount = 1

  #reportInterval?: NodeJS.Timeout

  #reportTimeout: NodeJS.Timeout | null = null

  private readonly driver: ClassicMELCloudDriver<T>

  get #energyCapabilityTagEntries(): EnergyCapabilityTagEntry<T>[] {
    const cleaned = this.#device.cleanMapping(
      this.driver.energyCapabilityTagMapping,
    )
    return typedEntries<
      string & keyof EnergyCapabilities<T>,
      readonly (keyof Classic.EnergyData<T>)[]
    >(cleaned).filter(
      ([capability]) =>
        isTotalEnergyKey(capability) === (this.#config.mode === 'total'),
    )
  }

  public constructor(
    device: ClassicMELCloudDevice<T>,
    config: EnergyReportConfig,
  ) {
    this.#device = device
    this.#config = config
    ;({ driver: this.driver, homey: this.#homey } = this.#device)
  }

  public async start(): Promise<void> {
    if (this.#energyCapabilityTagEntries.length === 0) {
      this.unschedule()
      return
    }
    await this.#get()
    this.#schedule()
  }

  public unschedule(): void {
    this.#homey.clearTimeout(this.#reportTimeout)
    this.#reportTimeout = null
    this.#homey.clearInterval(this.#reportInterval)
    this.#device.log(`${this.#config.mode} energy report has been cancelled`)
  }

  // COP (Coefficient of Performance) = produced energy / consumed energy.
  // Falls back to divisor of 1 to avoid division by zero when no energy consumed
  #calculateCopValue(
    data: Classic.EnergyData<T>,
    capability: string & keyof EnergyCapabilities<T>,
  ): number {
    const {
      driver: {
        consumedTagMapping: { [capability]: consumedTags = [] },
        producedTagMapping: { [capability]: producedTags = [] },
      },
    } = this
    return sumTags(data, producedTags) / (sumTags(data, consumedTags) || 1)
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
    hour: HourNumbers,
  ): number {
    let total = 0
    for (const tag of tags) {
      const { [tag]: tagData } = data
      if (Array.isArray(tagData)) {
        total += (tagData[hour] ?? 0) * KILOWATT_TO_WATT
      }
    }

    return total / this.#linkedDeviceCount
  }

  async #get(): Promise<void> {
    const device = await this.#device.ensureDevice()
    if (!device) {
      return
    }
    try {
      // Fetch energy data from the previous period (offset by config.minus)
      const toDateTime = DateTime.now().minus(this.#config.minus)
      const to = toDateTime.toISODate()
      await this.#set(
        await device.getEnergy({
          from: this.#config.mode === 'total' ? undefined : to,
          to,
        }),
        toDateTime.hour,
      )
    } catch (error) {
      this.#device.error('Energy report fetch failed:', error)
    }
  }

  #schedule(): void {
    if (this.#reportTimeout) {
      return
    }
    const actionType = `${this.#config.mode} energy report`
    this.#reportTimeout = this.#device.setTimeout(
      async () => {
        await this.start()
        this.#reportInterval = this.#device.setInterval(
          async () => this.start(),
          this.#config.interval,
          actionType,
        )
      },
      DateTime.now()
        .plus(this.#config.duration)
        .set(this.#config.values)
        .diffNow(),
      actionType,
    )
  }

  async #set(data: Classic.EnergyData<T>, hour: HourNumbers): Promise<void> {
    if ('UsageDisclaimerPercentages' in data) {
      ;({ length: this.#linkedDeviceCount } =
        data.UsageDisclaimerPercentages.split(','))
    }
    await Promise.all(
      this.#energyCapabilityTagEntries.map(
        async ([capability, tags]: [
          string & keyof EnergyCapabilities<T>,
          readonly (keyof Classic.EnergyData<T>)[],
        ]) => {
          if (capability.includes('cop')) {
            await this.#device.setCapabilityValue(
              capability,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- number result narrowed to energy capability type
              this.#calculateCopValue(
                data,
                capability,
              ) as Capabilities<T>[string & keyof EnergyCapabilities<T>],
            )
            return
          }
          if (capability.startsWith('measure_power')) {
            await this.#device.setCapabilityValue(
              capability,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- number result narrowed to energy capability type
              this.#calculatePowerValue(
                data,
                tags,
                hour,
              ) as Capabilities<T>[string & keyof EnergyCapabilities<T>],
            )
            return
          }
          await this.#device.setCapabilityValue(
            capability,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- number result narrowed to energy capability type
            this.#calculateEnergyValue(data, tags) as Capabilities<T>[string &
              keyof EnergyCapabilities<T>],
          )
        },
      ),
    )
  }
}
