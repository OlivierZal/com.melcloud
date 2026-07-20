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
  readonly setWarning: (warning: string | null) => Promise<void>
}

// Repeated failures earn a device warning; hourly reports make this
// roughly three hours of silence before the user is told.
const FAILURE_WARNING_THRESHOLD = 3

const APPLIED_VALUE_DECIMALS = 3

// Compact `capability=value` pairs so a diagnostics report shows what
// landed without dumping payloads; three decimals cover kWh readings.
const formatApplied = (applied: Record<string, number>): string =>
  Object.entries(applied)
    .map(
      ([capability, value]) =>
        `${capability}=${String(Number(value.toFixed(APPLIED_VALUE_DECIMALS)))}`,
    )
    .join(', ')

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

  #consecutiveFailures = 0

  readonly #device: ReportDevice

  #hasWarned = false

  #reportTimeout: NodeJS.Timeout | null = null

  get #actionType(): string {
    return `${this.#config.mode} energy report`
  }

  protected constructor(device: ReportDevice, config: EnergyReportConfig) {
    this.#device = device
    this.#config = config
  }

  // Returns the applied `capability → value` map, or `null` when the
  // run was skipped (unreachable device — `ensureDevice` already
  // warned it).
  protected abstract fetchAndApply(): Promise<Record<string, number> | null>

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
    let applied: Record<string, number> | null
    try {
      applied = await this.fetchAndApply()
    } catch (error) {
      this.#device.error('Energy report fetch failed:', error)
      await this.#registerFailure()
      return
    }
    if (applied !== null) {
      this.#device.log(
        `${this.#config.mode} energy report applied:`,
        formatApplied(applied),
      )
    }
    await this.#registerSuccess()
  }

  // Mirror of `ensureDevice`'s warning pattern: repeated report
  // failures surface on the device tile once, the next success clears
  // them. Skipped runs (`null`) count as neither — the device warning
  // for an unreachable unit is `ensureDevice`'s to manage.
  async #registerFailure(): Promise<void> {
    this.#consecutiveFailures += 1
    if (
      this.#consecutiveFailures < FAILURE_WARNING_THRESHOLD ||
      this.#hasWarned
    ) {
      return
    }
    this.#hasWarned = true
    await this.#setWarningSafely(
      this.#device.homey.__('errors.energyReportsFailing'),
    )
  }

  async #registerSuccess(): Promise<void> {
    this.#consecutiveFailures = 0
    if (!this.#hasWarned) {
      return
    }
    this.#hasWarned = false
    await this.#setWarningSafely(null)
  }

  // The warning update is IPC: its own failure must not break the
  // report chain.
  async #setWarningSafely(warning: string | null): Promise<void> {
    try {
      await this.#device.setWarning(warning)
    } catch (error) {
      this.#device.error('Failed to update the device warning:', error)
    }
  }
}
