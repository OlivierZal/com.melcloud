import { createHash } from 'node:crypto'

import type { Homey } from 'homey'
import { fireAndForget } from '@olivierzal/homey-kit'
import { logFailure } from '@olivierzal/melcloud-api'
import { Temporal } from 'temporal-polyfill'

import type { EnergyReportMode } from '../types/device.mts'
import { getNow } from '../lib/temporal.mts'
import type { HeldWarningReason } from './base-device.mts'

interface ReportDevice {
  readonly homey: Homey
  readonly id: number | string
  readonly error: (...args: unknown[]) => void
  readonly holdWarning: (reason: HeldWarningReason) => Promise<boolean>
  readonly log: (...args: unknown[]) => void
  readonly releaseWarning: (reason: HeldWarningReason) => Promise<boolean>
}

const capitalize = ([first = '', ...rest] = ''): string =>
  first.toUpperCase() + rest.join('')

// Three consecutive failures hold the device warning, the first success
// releases it: one failed fetch is noise, three in a row are not. Retries
// count as runs, so the user is told about fifty minutes into a failure
// on the hourly and daily reports, ten on the five-minute one when its
// failures are quick.
const FAILURE_WARNING_THRESHOLD = 3

// A failed run is retried before its cadence comes round: a quarter of an
// hour after the failure, twice as long after each further consecutive
// one up to four hours, and only while that comes sooner than the
// cadence. A failed daily read must not cost the day: on a Classic unit
// that is a flat `meter_power`, which Homey Energy books as 0 kWh. The
// streak only ends on a success: an outage costs an hourly report two
// extra fetches in all, a daily one nine a day at most, and the
// five-minute one none.
const FIRST_RETRY_MINUTES = 15
const LONGEST_RETRY_MINUTES = 240

// A slot less than a minute ahead counts as reached: a timer can fire a
// few milliseconds early, and the run it starts must not arm the same
// slot again.
const SLOT_GUARD: Temporal.DurationLike = { minutes: 1 }

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
  // The window each slot is spread over (see `spreadOffset`): required,
  // so no report can share one instant with every install of the app,
  // and longer than zero — a device's offset is a remainder of it.
  readonly spread: Temporal.DurationLike
  readonly values: Temporal.TimeLikeObject
  readonly minus?: Temporal.DurationLike
}

// A device's own place in a slot's window: the same from one run to the
// next, different from one device to another, so a slot is never one
// instant for every device of every install. MELCloud has answered such
// bursts with 500s, 502s and silence; whether the fleet causes those or
// only runs into them is not known.
const spreadOffset = (
  id: number | string,
  spread: Temporal.DurationLike,
): Temporal.Duration =>
  Temporal.Duration.from({
    milliseconds:
      createHash('sha256').update(String(id)).digest().readUInt32BE() %
      Temporal.Duration.from(spread).total({ unit: 'milliseconds' }),
  })

// Wall-clock-anchored report scheduler: every fire recomputes the next delay
// from the current zoned time (the next slot on the device's own grid —
// the slots shifted by its offset in their window), so a DST transition
// shifts nothing — a fixed-milliseconds interval would drift by the
// offset delta until the app restarts. A failed run arms an earlier
// retry instead (`FIRST_RETRY_MINUTES`).
export abstract class ScheduledEnergyReport {
  protected get mode(): EnergyReportMode {
    return this.#config.mode
  }

  readonly #config: EnergyReportConfig

  #consecutiveFailures = 0

  readonly #device: ReportDevice

  // One timer chain per report. Every arm and every `unschedule()` opens
  // a new generation, and a run arms the next timer only in the one it
  // belongs to: two runs can overlap (a settings change starts one while
  // a timer's is in flight, a fetch can outlive an `unschedule()`), and
  // the handle alone cannot tell a live timer from the fired one a run
  // still holds, nor an `unschedule()` from a report never armed.
  #generation = 0

  #reportTimeout: NodeJS.Timeout | undefined

  readonly #spreadOffset: Temporal.Duration

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
    this.#spreadOffset = spreadOffset(device.id, config.spread)
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
    const generation = this.#generation
    const failures = await this.#fetchSafely()
    // Beside a timer, pending or in its run, a `start()` arms nothing:
    // that timer's chain goes on.
    if (generation === this.#generation && this.#reportTimeout === undefined) {
      this.#armNext(failures)
    }
  }

  public unschedule(): void {
    this.#device.homey.clearTimeout(this.#reportTimeout)
    this.#reportTimeout = undefined
    this.#generation += 1
    this.#device.log(`${this.#config.mode} energy report has been cancelled`)
  }

  // Fetch offset used by implementations reading a previous period. The
  // subtraction is guarded: Temporal rejects an empty duration-like.
  protected reportDateTime(): Temporal.ZonedDateTime {
    const now = getNow(this.#device.homey)
    const { minus } = this.#config
    return minus === undefined ? now : now.subtract(minus)
  }

  #armNext(failures: number): void {
    const delay = this.#computeNextFireDelay(failures)
    this.#logNextRun(delay)
    this.#generation += 1
    const generation = this.#generation
    this.#reportTimeout = this.#device.homey.setTimeout(
      () => {
        fireAndForget(
          this.#runScheduled(generation),
          this.#device,
          `${this.#config.mode} energy report run failed:`,
        )
      },
      delay.total({ unit: 'milliseconds' }),
    )
  }

  // `failures` is the run's own place in its failure streak, 0 when it
  // did not fail.
  #computeNextFireDelay(failures: number): Temporal.Duration {
    const now = getNow(this.#device.homey)
    const cadence = this.#nextSlot(now).since(now)
    if (failures === 0) {
      return cadence
    }
    const retry = Temporal.Duration.from({
      minutes: Math.min(
        FIRST_RETRY_MINUTES * 2 ** (failures - 1),
        LONGEST_RETRY_MINUTES,
      ),
    })
    return Temporal.Duration.compare(retry, cadence) < 0 ? retry : cadence
  }

  // Answers the run's place in its failure streak, which is what earns
  // it a retry: 0 for an applied run, which re-anchors on the cadence,
  // and for a skipped one.
  async #fetchSafely(): Promise<number> {
    let applied: Record<string, number> | null
    try {
      applied = await this.fetchAndApply()
    } catch (error) {
      logFailure(this.#device, 'Energy report fetch failed:', error)
      return this.#registerFailure()
    }
    // A skipped run proves nothing about the report's health: the streak
    // and any held warning stay as they are — the unreachable-unit
    // warning is `ensureDevice`'s to manage.
    if (applied !== null) {
      await this.#registerSuccess(applied)
    }
    return 0
  }

  #logNextRun(delay: Temporal.Duration): void {
    const locale = this.#device.homey.i18n.getLanguage()
    this.#device.log(
      capitalize(this.#actionType),
      'will run in',
      delay.round({ largestUnit: 'days' }).toLocaleString(locale),
      'on',
      getNow(this.#device.homey)
        .add(delay)
        .toLocaleString(locale, { dateStyle: 'full', timeStyle: 'full' }),
    )
  }

  // The slots are aligned on the device's own grid: the clock is read
  // minus the offset, aligned, and the offset put back. Aligned as it
  // stands, a run ending past a boundary the offset straddles would land
  // a whole period late — every time, for a device whose offset sits at
  // the end of the five-minute report's minute. The slot is this
  // period's while it is still ahead: a start-up or a retry that ran
  // before it does not stand in for it, since a slot is the earliest
  // instant its figures can be trusted at. Otherwise it is the next
  // period's — unless a clock change puts that one behind as well: on
  // the night Lord Howe Island takes its half hour back, an hour after
  // 01:10 is 01:40, and its `minute: 5` is the 01:05 already gone. The
  // run is then a whole period away, off its slot for once, since a
  // slot behind is a delay below zero, which a timer runs at once and
  // again until the clock has passed it.
  #nextSlot(now: Temporal.ZonedDateTime): Temporal.ZonedDateTime {
    const frame = now.subtract(this.#spreadOffset)
    const nextPeriod = frame.add(this.#config.duration)
    const slot =
      [frame, nextPeriod]
        .map((period) => period.with(this.#config.values))
        .find(
          (aligned) =>
            Temporal.Duration.compare(aligned.since(frame), SLOT_GUARD) > 0,
        ) ?? nextPeriod
    return slot.add(this.#spreadOffset)
  }

  // Mirror of the unreadable-unit hold in `ensureDevice`: a failing
  // report is a LASTING condition, so it takes the held warning — the
  // device's toast would flash it and leave stale values unexplained.
  // From the third consecutive failure the report holds its reason on
  // every failed run (the device de-duplicates, so only the first costs
  // IPC and a failed IPC is retried by the next run), and the first
  // success releases it; a skipped run (`null`) counts as neither. The
  // verbs never throw, so the report chain survives a failed IPC, and each
  // transition is logged once, on the call that changed the record. It
  // answers the streak as this failure counted it: two runs of one
  // report can overlap (a settings change starts one while a timer's is
  // in flight), and the other may move the shared count during the hold.
  async #registerFailure(): Promise<number> {
    this.#consecutiveFailures += 1
    const failures = this.#consecutiveFailures
    if (
      failures >= FAILURE_WARNING_THRESHOLD &&
      (await this.#device.holdWarning(this.#reason))
    ) {
      this.#device.error(`${this.#actionType} failing, warning held`)
    }
    return failures
  }

  async #registerSuccess(applied: Record<string, number>): Promise<void> {
    this.#device.log(
      `${this.#config.mode} energy report applied:`,
      formatApplied(applied),
    )
    this.#consecutiveFailures = 0
    if (await this.#device.releaseWarning(this.#reason)) {
      this.#device.log(`${this.#actionType} recovered, warning released`)
    }
  }

  // `generation` is the one the run's timer was armed in: the run
  // carries the chain on only while that chain is still the live one.
  async #runScheduled(generation: number): Promise<void> {
    if (!this.hasEnabledCapabilities()) {
      this.unschedule()
      return
    }
    const failures = await this.#fetchSafely()
    if (generation === this.#generation) {
      this.#armNext(failures)
    }
  }
}
