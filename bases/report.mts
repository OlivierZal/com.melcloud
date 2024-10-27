import { DateTime, type DateObjectUnits, type DurationLike } from 'luxon'

import { K_MULTIPLIER } from '../lib/constants.mjs'
import { isTotalEnergyKey } from '../lib/isTotalEnergyKey.mjs'

import type {
  DeviceFacade,
  DeviceType,
  EnergyData,
} from '@olivierzal/melcloud-api'
import type Homey from 'homey/lib/Homey'

import type {
  Capabilities,
  EnergyCapabilities,
  EnergyCapabilityTagEntry,
  EnergyCapabilityTagMapping,
  EnergyReportMode,
  MELCloudDriver,
} from '../types/index.mjs'

import type { BaseMELCloudDevice } from './device.mjs'

const INITIAL_SUM = 0
const DEFAULT_DEVICE_COUNT = 1
const DEFAULT_DIVISOR = 1

export abstract class BaseEnergyReport<T extends keyof typeof DeviceType> {
  readonly #device: BaseMELCloudDevice<T>

  readonly #driver: MELCloudDriver[T]

  readonly #facade: DeviceFacade[T]

  readonly #homey: Homey

  #energyCapabilityTagEntries: EnergyCapabilityTagEntry<T>[] = []

  #linkedDeviceCount = DEFAULT_DEVICE_COUNT

  #reportInterval: NodeJS.Timeout | null = null

  #reportTimeout: NodeJS.Timeout | null = null

  protected abstract readonly duration: DurationLike

  protected abstract readonly interval: DurationLike

  protected abstract readonly minus: DurationLike

  protected abstract readonly mode: EnergyReportMode

  protected abstract readonly values: DateObjectUnits

  public constructor(device: BaseMELCloudDevice<T>, facade: DeviceFacade[T]) {
    this.#device = device
    ;({ driver: this.#driver, homey: this.#homey } = this.#device)
    this.#facade = facade
  }

  public async handle(): Promise<void> {
    this.#setEnergyCapabilityTagEntries()
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
    this.#reportInterval = null
    this.#device.log(`${this.mode} energy report has been cancelled`)
  }

  #calculateCopValue(
    data: EnergyData[T],
    capability: string & keyof EnergyCapabilities[T],
  ): number {
    const producedTags = this.#driver.producedTagMapping[
      capability
    ] as (keyof EnergyData[T])[]
    const consumedTags = this.#driver.consumedTagMapping[
      capability
    ] as (keyof EnergyData[T])[]
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
    data: EnergyData[T],
    tags: (keyof EnergyData[T])[],
  ): number {
    return (
      tags.reduce((acc, tag) => acc + (data[tag] as number), INITIAL_SUM) /
      this.#linkedDeviceCount
    )
  }

  #calculatePowerValue(
    data: EnergyData[T],
    tags: (keyof EnergyData[T])[],
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
    try {
      const toDateTime = DateTime.now().minus(this.minus)
      const to = toDateTime.toISODate()
      await this.#set(
        (await this.#facade.getEnergyReport({
          from: this.mode === 'total' ? undefined : to,
          to,
        })) as EnergyData[T],
        toDateTime.hour,
      )
    } catch (error) {
      await this.#device.setWarning(error)
    }
  }

  #schedule(): void {
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

  async #set(data: EnergyData[T], hour: number): Promise<void> {
    if ('UsageDisclaimerPercentages' in data) {
      ;({ length: this.#linkedDeviceCount } =
        data.UsageDisclaimerPercentages.split(','))
    }
    await Promise.all(
      this.#energyCapabilityTagEntries.map(
        async <
          K extends Extract<keyof EnergyCapabilities[T], string>,
          L extends keyof EnergyData[T],
        >([capability, tags]: [K, L[]]) => {
          if (capability.includes('cop')) {
            await this.#device.setCapabilityValue(
              capability,
              this.#calculateCopValue(data, capability) as Capabilities[T][K],
            )
            return
          }
          if (capability.startsWith('measure_power')) {
            await this.#device.setCapabilityValue(
              capability,
              this.#calculatePowerValue(data, tags, hour) as Capabilities[T][K],
            )
            return
          }
          await this.#device.setCapabilityValue(
            capability,
            this.#calculateEnergyValue(data, tags) as Capabilities[T][K],
          )
        },
      ),
    )
  }

  #setEnergyCapabilityTagEntries(): void {
    const energyCapabilityTagEntries = Object.entries(
      this.#device.cleanMapping(
        this.#driver
          .energyCapabilityTagMapping as EnergyCapabilityTagMapping[T],
      ),
    ) as EnergyCapabilityTagEntry<T>[]
    this.#energyCapabilityTagEntries = energyCapabilityTagEntries.filter(
      ([capability]) =>
        isTotalEnergyKey(capability) === (this.mode === 'total'),
    )
  }
}
