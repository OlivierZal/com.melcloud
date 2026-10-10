import type Homey from 'homey/lib/Homey'
import type { Temporal } from 'temporal-polyfill'

import type { EnergyReportMode } from '../types/device.mts'
import { getNow } from '../lib/temporal.mts'
import type { HeldWarningReason } from './base-device.mts'

interface ReportDevice {
  readonly homey: Homey.Homey
  readonly error: (...args: unknown[]) => void
  readonly holdWarning: (reason: HeldWarningReason) => Promise<boolean>
  readonly log: (...args: unknown[]) => void
  readonly releaseWarning: (reason: HeldWarningReason) => Promise<boolean>
  readonly setTimeout: (
    callback: () => Promise<void>,
    interval: Temporal.DurationLike,
    actionType: string,
  ) => NodeJS.Timeout
}

// Three consecutive failures hold the device warning, the first success
// releases it: one failed fetch is noise, three in a row are not. The
// silence before the user is told is three runs of the report's own
// cadence — a quarter of an hour to three days across the drivers.
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

  #reportTimeout: NodeJS.Timeout | null = null

  get #actionType(): string {
    return `${this.#config.mode} energy report`
  }

  // Each report mode is a held reason of its own: the two reports of a
  // device fetch and fail independently, so one recovering must not clear
  // the warning the other still earns.
  get #reason(): HeldWarningReason {
    return `${this.#config.mode}EnergyReports`
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
    // A skipped run proves nothing about the report's health: the streak
    // and any held warning stay as they are — the unreachable-unit
    // warning is `ensureDevice`'s to manage.
    if (applied === null) {
      return
    }
    this.#device.log(
      `${this.#config.mode} energy report applied:`,
      formatApplied(applied),
    )
    await this.#registerSuccess()
  }

  // Mirror of the unreadable-unit hold in `ensureDevice`: a failing
  // report is a LASTING condition, so it takes the held warning — the
  // device's toast would flash it and leave stale values unexplained.
  // From the third consecutive failure the report holds its reason on
  // every failed run (the device de-duplicates, so only the first costs
  // IPC and a failed IPC is retried by the next run), and the first
  // success releases it; a skipped run (`null`) counts as neither. The
  // verbs never throw, so the report chain survives a failed IPC, and each
  // transition is logged once, on the call that changed the record.
  async #registerFailure(): Promise<void> {
    this.#consecutiveFailures += 1
    if (this.#consecutiveFailures < FAILURE_WARNING_THRESHOLD) {
      return
    }
    if (await this.#device.holdWarning(this.#reason)) {
      this.#device.error(`${this.#actionType} failing, warning held`)
    }
  }

  async #registerSuccess(): Promise<void> {
    this.#consecutiveFailures = 0
    if (await this.#device.releaseWarning(this.#reason)) {
      this.#device.log(`${this.#actionType} recovered, warning released`)
    }
  }
}
