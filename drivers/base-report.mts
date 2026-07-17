import type Homey from 'homey/lib/Homey'
import type { Temporal } from 'temporal-polyfill'

import type { EnergyReportMode } from '../types/device.mts'
import { getNow } from '../lib/temporal.mts'

interface ReportDevice {
  readonly homey: Homey.Homey
  readonly error: (...args: unknown[]) => void
  readonly log: (...args: unknown[]) => void
  readonly setTimeout: (
    callback: () => Promise<void>,
    interval: Temporal.DurationLike,
    actionType: string,
  ) => NodeJS.Timeout
}

export interface EnergyReportConfig {
  readonly duration: Temporal.DurationLike
  readonly mode: EnergyReportMode
  readonly values: Temporal.TimeLikeObject
  readonly minus?: Temporal.DurationLike
}

// Wall-clock-anchored report scheduler: every fire recomputes the next delay
// from the current zoned time (duration + values alignment), so a DST
// transition shifts nothing — a fixed-milliseconds interval would drift by
// the offset delta until the app restarts.
export abstract class ScheduledEnergyReport {
  protected get mode(): EnergyReportMode {
    return this.#config.mode
  }

  readonly #config: EnergyReportConfig

  readonly #device: ReportDevice

  #reportTimeout: NodeJS.Timeout | null = null

  get #actionType(): string {
    return `${this.#config.mode} energy report`
  }

  protected constructor(device: ReportDevice, config: EnergyReportConfig) {
    this.#device = device
    this.#config = config
  }

  protected abstract fetchAndApply(): Promise<void>

  protected abstract hasEnabledCapabilities(): boolean

  public async start(): Promise<void> {
    if (!this.hasEnabledCapabilities()) {
      this.unschedule()
      return
    }
    await this.#fetchSafely()
    if (this.#reportTimeout === null) {
      this.#armNext()
    }
  }

  public unschedule(): void {
    this.#device.homey.clearTimeout(this.#reportTimeout)
    this.#reportTimeout = null
    this.#device.log(`${this.#config.mode} energy report has been cancelled`)
  }

  // Fetch offset used by implementations reading a previous period. The
  // subtraction is guarded: Temporal rejects an empty duration-like.
  protected reportDateTime(): Temporal.ZonedDateTime {
    const now = getNow(this.#device.homey)
    const { minus } = this.#config
    return minus === undefined ? now : now.subtract(minus)
  }

  #armNext(): void {
    this.#reportTimeout = this.#device.setTimeout(
      async () => {
        if (!this.hasEnabledCapabilities()) {
          this.unschedule()
          return
        }
        await this.#fetchSafely()
        // Unschedule during the await nulls the handle: stop the chain.
        if (this.#reportTimeout !== null) {
          this.#armNext()
        }
      },
      this.#computeNextFireDelay(),
      this.#actionType,
    )
  }

  #computeNextFireDelay(): Temporal.Duration {
    const now = getNow(this.#device.homey)
    return now.add(this.#config.duration).with(this.#config.values).since(now)
  }

  async #fetchSafely(): Promise<void> {
    try {
      await this.fetchAndApply()
    } catch (error) {
      this.#device.error('Energy report fetch failed:', error)
    }
  }
}
