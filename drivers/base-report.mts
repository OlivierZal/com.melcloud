import type { DeviceType, EnergyData } from '@olivierzal/melcloud-api'
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
  EnergyReportMode,
} from '../types/index.mts'

import { isTotalEnergyKey, typedEntries } from '../lib/index.mts'

import type { BaseMELCloudDevice } from './base-device.mts'
import type { BaseMELCloudDriver } from './base-driver.mts'

const K_MULTIPLIER = 1000

const DEFAULT_ZERO = 0
const DEFAULT_DIVISOR_ONE = 1

const DEFAULT_DEVICE_COUNT_ONE = 1

const sumTags = <T extends DeviceType>(
  data: EnergyData<T>,
  tags: readonly (keyof EnergyData<T>)[],
): number =>
  tags.reduce(
    (accumulator, tag) => accumulator + Number(data[tag]),
    DEFAULT_ZERO,
  )

export interface EnergyReportConfig {
  readonly duration: DurationLike
  readonly interval: DurationLike
  readonly minus: DurationLike
  readonly mode: EnergyReportMode
  readonly values: DateObjectUnits
}

export class EnergyReport<T extends DeviceType> {
  readonly #config: EnergyReportConfig

  readonly #device: BaseMELCloudDevice<T>

  readonly #homey: Homey.Homey

  private readonly driver: BaseMELCloudDriver<T>

  #linkedDeviceCount = DEFAULT_DEVICE_COUNT_ONE

  #reportTimeout: NodeJS.Timeout | null = null

  #reportInterval?: NodeJS.Timeout

  public constructor(
    device: BaseMELCloudDevice<T>,
    config: EnergyReportConfig,
  ) {
    this.#device = device
    this.#config = config
    ;({ driver: this.driver, homey: this.#homey } = this.#device)
  }

  get #energyCapabilityTagEntries(): EnergyCapabilityTagEntry<T>[] {
    return typedEntries<
      string & keyof EnergyCapabilities<T>,
      readonly (keyof EnergyData<T>)[]
    >(this.#device.cleanMapping(this.driver.energyCapabilityTagMapping)).filter(
      ([capability]) =>
        isTotalEnergyKey(capability) === (this.#config.mode === 'total'),
    )
  }

  public async handle(): Promise<void> {
    if (!this.#energyCapabilityTagEntries.length) {
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

  #calculateCopValue(
    data: EnergyData<T>,
    capability: string & keyof EnergyCapabilities<T>,
  ): number {
    const {
      driver: {
        producedTagMapping: { [capability]: producedTags = [] },
      },
    } = this
    const {
      driver: {
        consumedTagMapping: { [capability]: consumedTags = [] },
      },
    } = this
    return (
      sumTags(data, producedTags) /
      (sumTags(data, consumedTags) || DEFAULT_DIVISOR_ONE)
    )
  }

  #calculateEnergyValue(
    data: EnergyData<T>,
    tags: readonly (keyof EnergyData<T>)[],
  ): number {
    return sumTags(data, tags) / this.#linkedDeviceCount
  }

  #calculatePowerValue(
    data: EnergyData<T>,
    tags: readonly (keyof EnergyData<T>)[],
    hour: HourNumbers,
  ): number {
    let total = DEFAULT_ZERO
    for (const tag of tags) {
      const { [tag]: tagData } = data
      if (Array.isArray(tagData)) {
        total += (tagData[hour] ?? DEFAULT_ZERO) * K_MULTIPLIER
      }
    }
    return total / this.#linkedDeviceCount
  }

  async #get(): Promise<void> {
    const device = await this.#device.fetchDevice()
    if (device) {
      try {
        const toDateTime = DateTime.now().minus(this.#config.minus)
        const to = toDateTime.toISODate()
        await this.#set(
          await device.getEnergy({
            from: this.#config.mode === 'total' ? undefined : to,
            to,
          }),
          toDateTime.hour,
        )
      } catch {}
    }
  }

  #schedule(): void {
    if (!this.#reportTimeout) {
      const actionType = `${this.#config.mode} energy report`
      this.#reportTimeout = this.#device.setTimeout(
        async () => {
          await this.handle()
          this.#reportInterval = this.#device.setInterval(
            async () => this.handle(),
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
  }

  async #set(data: EnergyData<T>, hour: HourNumbers): Promise<void> {
    if ('UsageDisclaimerPercentages' in data) {
      ;({ length: this.#linkedDeviceCount } =
        data.UsageDisclaimerPercentages.split(','))
    }
    await Promise.all(
      this.#energyCapabilityTagEntries.map(
        async ([capability, tags]: [
          string & keyof EnergyCapabilities<T>,
          readonly (keyof EnergyData<T>)[],
        ]) => {
          if (capability.includes('cop')) {
            await this.#device.setCapabilityValue(
              capability,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
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
              // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            this.#calculateEnergyValue(data, tags) as Capabilities<T>[string &
              keyof EnergyCapabilities<T>],
          )
        },
      ),
    )
  }
}
