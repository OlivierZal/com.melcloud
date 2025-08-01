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

import { isTotalEnergyKey, K_MULTIPLIER, LENGTH_ZERO } from '../lib/index.mts'

import type { BaseMELCloudDevice } from './base-device.mts'
import type { BaseMELCloudDriver } from './base-driver.mts'

const DEFAULT_ZERO = 0
const DEFAULT_DIVISOR_ONE = 1

const DEFAULT_DEVICE_COUNT_ONE = 1

export abstract class BaseEnergyReport<T extends DeviceType> {
  readonly #device: BaseMELCloudDevice<T>

  readonly #homey: Homey.Homey

  private readonly driver: BaseMELCloudDriver<T>

  #linkedDeviceCount = DEFAULT_DEVICE_COUNT_ONE

  #reportTimeout: NodeJS.Timeout | null = null

  #reportInterval?: NodeJS.Timeout

  protected abstract readonly duration: DurationLike

  protected abstract readonly interval: DurationLike

  protected abstract readonly minus: DurationLike

  protected abstract readonly mode: EnergyReportMode

  protected abstract readonly values: DateObjectUnits

  public constructor(device: BaseMELCloudDevice<T>) {
    this.#device = device
    ;({ driver: this.driver, homey: this.#homey } = this.#device)
  }

  get #energyCapabilityTagEntries(): EnergyCapabilityTagEntry<T>[] {
    return (
      Object.entries(
        this.#device.cleanMapping(this.driver.energyCapabilityTagMapping),
      ) as EnergyCapabilityTagEntry<T>[]
    ).filter(
      ([capability]) =>
        isTotalEnergyKey(capability) === (this.mode === 'total'),
    )
  }

  public async handle(): Promise<void> {
    if (this.#energyCapabilityTagEntries.length === LENGTH_ZERO) {
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
    this.#device.log(`${this.mode} energy report has been cancelled`)
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
      producedTags.reduce(
        (accumulator, tag) => accumulator + Number(data[tag]),
        DEFAULT_ZERO,
      ) /
      (consumedTags.reduce(
        (accumulator, tag) => accumulator + Number(data[tag]),
        DEFAULT_ZERO,
      ) || DEFAULT_DIVISOR_ONE)
    )
  }

  #calculateEnergyValue(
    data: EnergyData<T>,
    tags: (keyof EnergyData<T>)[],
  ): number {
    return (
      tags.reduce(
        (accumulator, tag) => accumulator + Number(data[tag]),
        DEFAULT_ZERO,
      ) / this.#linkedDeviceCount
    )
  }

  #calculatePowerValue(
    data: EnergyData<T>,
    tags: (keyof EnergyData<T>)[],
    hour: HourNumbers,
  ): number {
    return (
      tags.reduce(
        (accumulator, tag) =>
          accumulator +
          ((data[tag] as number[])[hour] ?? DEFAULT_ZERO) * K_MULTIPLIER,
        DEFAULT_ZERO,
      ) / this.#linkedDeviceCount
    )
  }

  async #get(): Promise<void> {
    const device = await this.#device.fetchDevice()
    if (device) {
      try {
        const toDateTime = DateTime.now().minus(this.minus)
        const to = toDateTime.toISODate()
        await this.#set(
          await device.energy({
            from: this.mode === 'total' ? undefined : to,
            to,
          }),
          toDateTime.hour,
        )
      } catch {}
    }
  }

  #schedule(): void {
    if (!this.#reportTimeout) {
      const actionType = `${this.mode} energy report`
      this.#reportTimeout = this.#device.setTimeout(
        async () => {
          await this.handle()
          this.#reportInterval = this.#device.setInterval(
            async () => this.handle(),
            this.interval,
            actionType,
          )
        },
        DateTime.now().plus(this.duration).set(this.values).diffNow(),
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
          (keyof EnergyData<T>)[],
        ]) => {
          if (capability.includes('cop')) {
            await this.#device.setCapabilityValue(
              capability,
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
            this.#calculateEnergyValue(data, tags) as Capabilities<T>[string &
              keyof EnergyCapabilities<T>],
          )
        },
      ),
    )
  }
}
