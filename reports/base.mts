import { DateTime, type DateObjectUnits, type DurationLike } from 'luxon'

import { K_MULTIPLIER } from '../constants.mts'
import { isTotalEnergyKey } from '../lib/is-total-energy-key.mts'

import type { DeviceType, EnergyData } from '@olivierzal/melcloud-api'
import type Homey from 'homey/lib/Homey'

import type { BaseMELCloudDevice } from '../drivers/base-device.mts'
import type {
  Capabilities,
  EnergyCapabilities,
  EnergyCapabilityTagEntry,
  EnergyCapabilityTagMapping,
  EnergyReportMode,
  MELCloudDriver,
} from '../types/index.mts'

const INITIAL_SUM = 0
const DEFAULT_DEVICE_COUNT = 1
const DEFAULT_DIVISOR = 1

export abstract class BaseEnergyReport<T extends DeviceType> {
  readonly #device: BaseMELCloudDevice<T>

  readonly #driver: MELCloudDriver<T>

  readonly #homey: Homey

  #linkedDeviceCount = DEFAULT_DEVICE_COUNT

  #reportTimeout: NodeJS.Timeout | null = null

  #reportInterval?: NodeJS.Timeout

  protected abstract readonly duration: DurationLike

  protected abstract readonly interval: DurationLike

  protected abstract readonly minus: DurationLike

  protected abstract readonly mode: EnergyReportMode

  protected abstract readonly values: DateObjectUnits

  public constructor(device: BaseMELCloudDevice<T>) {
    this.#device = device
    ;({ driver: this.#driver, homey: this.#homey } = this.#device)
  }

  get #energyCapabilityTagEntries(): EnergyCapabilityTagEntry<T>[] {
    return (
      Object.entries(
        this.#device.cleanMapping(
          this.#driver
            .energyCapabilityTagMapping as EnergyCapabilityTagMapping<T>,
        ),
      ) as EnergyCapabilityTagEntry<T>[]
    ).filter(
      ([capability]) =>
        isTotalEnergyKey(capability) === (this.mode === 'total'),
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
    this.#device.log(`${this.mode} energy report has been cancelled`)
  }

  #calculateCopValue(
    data: EnergyData<T>,
    capability: string & keyof EnergyCapabilities<T>,
  ): number {
    const producedTags = this.#driver.producedTagMapping[
      capability
    ] as (keyof EnergyData<T>)[]
    const consumedTags = this.#driver.consumedTagMapping[
      capability
    ] as (keyof EnergyData<T>)[]
    return (
      producedTags.reduce(
        (acc, tag) => acc + (data[tag] as number),
        INITIAL_SUM,
      ) /
      (consumedTags.reduce(
        (acc, tag) => acc + (data[tag] as number),
        INITIAL_SUM,
      ) || DEFAULT_DIVISOR)
    )
  }

  #calculateEnergyValue(
    data: EnergyData<T>,
    tags: (keyof EnergyData<T>)[],
  ): number {
    return (
      tags.reduce((acc, tag) => acc + (data[tag] as number), INITIAL_SUM) /
      this.#linkedDeviceCount
    )
  }

  #calculatePowerValue(
    data: EnergyData<T>,
    tags: (keyof EnergyData<T>)[],
    hour: number,
  ): number {
    return (
      tags.reduce(
        (acc, tag) => acc + (data[tag] as number[])[hour] * K_MULTIPLIER,
        INITIAL_SUM,
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
          await device.getEnergyReport({
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

  async #set(data: EnergyData<T>, hour: number): Promise<void> {
    if ('UsageDisclaimerPercentages' in data) {
      ;({ length: this.#linkedDeviceCount } =
        data.UsageDisclaimerPercentages.split(','))
    }
    await Promise.all(
      this.#energyCapabilityTagEntries.map(
        async <
          K extends Extract<keyof EnergyCapabilities<T>, string>,
          L extends keyof EnergyData<T>,
        >([capability, tags]: [K, L[]]) => {
          if (capability.includes('cop')) {
            await this.#device.setCapabilityValue(
              capability,
              this.#calculateCopValue(data, capability) as Capabilities<T>[K],
            )
            return
          }
          if (capability.startsWith('measure_power')) {
            await this.#device.setCapabilityValue(
              capability,
              this.#calculatePowerValue(data, tags, hour) as Capabilities<T>[K],
            )
            return
          }
          await this.#device.setCapabilityValue(
            capability,
            this.#calculateEnergyValue(data, tags) as Capabilities<T>[K],
          )
        },
      ),
    )
  }
}
