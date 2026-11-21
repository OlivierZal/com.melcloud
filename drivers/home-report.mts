import type * as Home from '@olivierzal/melcloud-api/home'
import { Temporal } from 'temporal-polyfill'

import type { HomeEnergyMeasureName } from '../types/device.mts'
import type { HomeDeviceFacade } from '../types/home.mts'
import { KILO } from '../lib/constants.mts'
import { isTotalEnergyKey } from '../lib/is-total-energy-key.mts'
import { getNow } from '../lib/temporal.mts'
import { typedEntries, typedFromEntries } from '../lib/typed-object.mts'
import { unwrapResult } from '../lib/unwrap-result.mts'
import type { HomeMELCloudDevice } from './home-device.mts'
import {
  type EnergyReportConfig,
  ScheduledEnergyReport,
} from './base-report.mts'

// An hour bucket is the finest grain the Home wire serves, each stamped
// with its start: every figure below is built from whole buckets.
const HOUR: Temporal.DurationLike = { hours: 1 }
// No live power exists on the Home wire: a reading is an average over
// this many hour buckets.
const POWER_WINDOW_HOURS = 2
const POWER_WINDOW: Temporal.DurationLike = { hours: POWER_WINDOW_HOURS }
// A bucket joins a lifetime total once it has closed, an hour after its
// start, and stood four minutes more: energy landing later would sit
// behind the cursor and never be counted. A closed bucket has read
// final from its close on (melcloud-api's CLAUDE.md holds the
// measurements), where the minute buckets of old landed up to two
// minutes late; and four minutes count the hour that has just closed
// at the report's own slot, five past.
const SETTLED_BUCKET_AGE: Temporal.DurationLike = { hours: 1, minutes: 4 }
// Downtime is caught up a week per run. A read costs one request per
// day of its window, and a window left to grow could fail, and grow,
// for good.
const CATCH_UP_HOURS = 168
const CATCH_UP: Temporal.DurationLike = { hours: CATCH_UP_HOURS }
// The wire keeps about three months of energy: a watermark older than
// ninety days starts there, what lies before it being gone. Left
// where it was, a meter back from a long sleep would walk up to the
// present a week per run, through windows the wire may refuse, and
// stand still for good on the first it did.
const RETENTION_HOURS = 2160
const RETENTION: Temporal.DurationLike = { hours: RETENTION_HOURS }

type EnergyEntry = readonly [string, readonly HomeEnergyMeasureName[]]

// One hour bucket: the library's epoch-ms stamp of its start as an
// instant, its energy in kWh whatever the device type.
interface EnergyPoint {
  readonly instant: Temporal.Instant
  readonly value: number
}

// A span of bucket starts: `from` inclusive, `to` exclusive.
interface EnergyWindow {
  readonly from: Temporal.Instant
  readonly to: Temporal.Instant
}

// The buckets of every direction; a direction the unit does not report
// holds none.
type MeasurePoints = Record<HomeEnergyMeasureName, readonly EnergyPoint[]>

const NO_POINTS: MeasurePoints = { consumed: [], produced: [] }

interface RegularBoundaries {
  readonly dayStart: Temporal.Instant
  readonly now: Temporal.Instant
}

// Per-type policy over the library's normalized hourly series: how to
// read the buckets of every direction the unit reports — one read for
// all of them — and how to derive a power reading from them. The engine
// below takes one of the two objects at the end of this file and stays
// type-agnostic.
export interface HomeEnergyStrategy<T extends Home.DeviceType> {
  readonly fetchPoints: (
    facade: HomeDeviceFacade<T>,
    query: Home.EnergySeriesQuery,
  ) => Promise<MeasurePoints>
  readonly watts: (
    points: readonly EnergyPoint[],
    now: Temporal.Instant,
  ) => number
}

const cursorKey = (measure: HomeEnergyMeasureName): string =>
  `energy_cursor_${measure}`
const totalKey = (measure: HomeEnergyMeasureName): string =>
  `energy_total_${measure}`

// The library owns the whole wire decode (stamps, units, garbled
// samples); what remains here is window policy over its degraded
// fields: a `null` energy counts as 0 like the Classic report's tags,
// and a sample without an instant cannot join any window, so it is
// dropped.
const toEnergyPoints = (
  points: readonly Home.EnergySeriesPoint[],
): EnergyPoint[] =>
  points.flatMap(({ atEpochMs, kilowattHours }) =>
    atEpochMs === null
      ? []
      : {
          instant: Temporal.Instant.fromEpochMilliseconds(atEpochMs),
          value: kilowattHours ?? 0,
        },
  )

const toQuery = ({ from, to }: EnergyWindow): Home.EnergySeriesQuery => ({
  from: from.toString(),
  to: to.toString(),
})

const laterOf = (
  first: Temporal.Instant,
  second: Temporal.Instant,
): Temporal.Instant =>
  Temporal.Instant.compare(first, second) > 0 ? first : second

const sumBetween = (
  points: readonly EnergyPoint[],
  { from, to }: EnergyWindow,
): number => {
  let sum = 0
  for (const { instant, value } of points) {
    if (
      Temporal.Instant.compare(instant, from) >= 0 &&
      Temporal.Instant.compare(instant, to) < 0
    ) {
      sum += value
    }
  }
  return sum
}

// The window one total run reads: from the oldest watermark the horizon
// has moved past, a catch-up span at most. `null` when no watermark is
// behind it — nothing closed since the last run, or no meter started.
const toAccrualWindow = (
  cursors: Iterable<Temporal.Instant | null>,
  horizon: Temporal.Instant,
): EnergyWindow | null => {
  const [from] = [...cursors]
    .filter((cursor) => cursor !== null)
    .filter((cursor) => Temporal.Instant.compare(cursor, horizon) < 0)
    .toSorted((first, second) => Temporal.Instant.compare(first, second))
  if (from === undefined) {
    return null
  }
  const end = from.add(CATCH_UP)
  return {
    from,
    to: Temporal.Instant.compare(end, horizon) < 0 ? end : horizon,
  }
}

// Start of the hour bucket in progress, read off the buckets themselves:
// an air-to-water bucket starts on the unit's own clock, which is not a
// round UTC hour everywhere. `null` when the wire left out both that
// bucket and the one before it.
const toHourInProgress = (
  points: readonly EnergyPoint[],
  now: Temporal.Instant,
): Temporal.Instant | null => {
  const earliest = now.subtract(POWER_WINDOW)
  const [latest] = points
    .map(({ instant }) => instant)
    .filter(
      (instant) =>
        Temporal.Instant.compare(instant, earliest) > 0 &&
        Temporal.Instant.compare(instant, now) <= 0,
    )
    .toSorted((first, second) => Temporal.Instant.compare(second, first))
  if (latest === undefined) {
    return null
  }
  return Temporal.Instant.compare(latest, now.subtract(HOUR)) > 0
    ? latest
    : latest.add(HOUR)
}

const uniqueMeasures = (
  entries: readonly EnergyEntry[],
): HomeEnergyMeasureName[] => [
  ...new Set(entries.flatMap(([, measures]) => measures)),
]

const totalValue = (
  [capability, measures]: EnergyEntry,
  totals: Partial<Record<HomeEnergyMeasureName, number>>,
): number => {
  if (capability.includes('cop')) {
    const consumed = totals.consumed ?? 0
    return (totals.produced ?? 0) / (consumed === 0 ? 1 : consumed)
  }
  const [measure = 'consumed'] = measures
  return totals[measure] ?? 0
}

export class HomeEnergyReport<
  T extends Home.DeviceType,
> extends ScheduledEnergyReport {
  readonly #device: HomeMELCloudDevice<T>

  // The last total run, settled or not: the next one waits for it.
  #lastTotalRun: Promise<unknown> = Promise.resolve()

  readonly #strategy: HomeEnergyStrategy<T>

  get #enabledEntries(): EnergyEntry[] {
    const cleaned = this.#device.cleanMapping(
      this.#device.driver.tagMappings.energy,
    )
    return typedEntries<string, readonly HomeEnergyMeasureName[]>(
      cleaned,
    ).filter(
      ([capability]) =>
        isTotalEnergyKey(capability) === (this.mode === 'total'),
    )
  }

  public constructor(
    device: HomeMELCloudDevice<T>,
    config: EnergyReportConfig,
    strategy: HomeEnergyStrategy<T>,
  ) {
    super(device, config)
    this.#device = device
    this.#strategy = strategy
  }

  protected override async fetchAndApply(): Promise<Record<
    string,
    number
  > | null> {
    const facade = await this.#device.ensureDevice()
    if (facade === null) {
      return null
    }
    return this.mode === 'total'
      ? this.#applyTotalsInTurn(facade)
      : this.#applyRegular(facade)
  }

  protected override hasEnabledCapabilities(): boolean {
    return this.#enabledEntries.length > 0
  }

  // Monotonic app-side meters: the Home API keeps ~3 months of energy
  // (with a mixed-semantics past), so lifetime totals accrue locally
  // from a persisted cursor — every bucket that started before it is
  // counted — and downtime is caught up over the next runs.
  async #accrueTotal(
    measure: HomeEnergyMeasureName,
    points: readonly EnergyPoint[],
    { from, to }: EnergyWindow,
  ): Promise<number> {
    const total =
      this.#storedNumber(totalKey(measure)) + sumBetween(points, { from, to })
    // The watermark only ever moves FORWARD. A Homey booting with a
    // clock still behind — a power cut, an NTP step — computes a
    // horizon in the past, and rewinding to it would have the next run
    // re-accrue buckets already counted. A lifetime meter cannot
    // unlearn that.
    const cursor = laterOf(from, to)
    // The watermark is committed BEFORE the total. The two writes
    // cannot be atomic, and an interruption between them is PERMANENT
    // either way: this order undercounts by one window, the reverse
    // overcounts by one. Neither self-heals, so the choice is which
    // error to prefer — and a meter that invents energy misreports
    // consumption upward forever, taking Insights and every cost figure
    // built on it along. Losing a window is the failure worth choosing.
    await this.#device.setStoreValue(cursorKey(measure), cursor.toString())
    await this.#device.setStoreValue(totalKey(measure), total)
    return total
  }

  // Writes the computed pairs to the device and returns them as the
  // applied `capability → value` map the base contract expects.
  async #applyPairs(
    applied: readonly (readonly [string, number])[],
  ): Promise<Record<string, number>> {
    await Promise.all(
      applied.map(async ([capability, value]) =>
        this.#device.setCapabilityValue(capability, value),
      ),
    )
    return Object.fromEntries(applied)
  }

  async #applyRegular(
    facade: HomeDeviceFacade<T>,
  ): Promise<Record<string, number>> {
    const entries = this.#enabledEntries
    const now = getNow(this.#device.homey)
    const nowInstant = now.toInstant()
    const dayStart = now.startOfDay().toInstant()
    const powerStart = nowInstant.subtract(POWER_WINDOW)
    const points = await this.#strategy.fetchPoints(
      facade,
      toQuery({
        from:
          Temporal.Instant.compare(dayStart, powerStart) <= 0
            ? dayStart
            : powerStart,
        to: nowInstant,
      }),
    )
    return this.#applyPairs(
      entries.map(
        (entry) =>
          [
            entry[0],
            this.#regularValue(entry, points, { dayStart, now: nowInstant }),
          ] as const,
      ),
    )
  }

  async #applyTotals(
    facade: HomeDeviceFacade<T>,
    previous: Promise<unknown>,
  ): Promise<Record<string, number>> {
    await Promise.allSettled([previous])
    const entries = this.#enabledEntries
    const horizon = getNow(this.#device.homey)
      .toInstant()
      .subtract(SETTLED_BUCKET_AGE)
    const cursors = this.#liveCursors(uniqueMeasures(entries), horizon)
    const window = toAccrualWindow(cursors.values(), horizon)
    const points =
      window === null
        ? NO_POINTS
        : await this.#strategy.fetchPoints(facade, toQuery(window))
    const totals = typedFromEntries(
      await Promise.all(
        [...cursors].map(
          async ([measure, cursor]) =>
            [
              measure,
              // A meter with no watermark starts at the horizon,
              // whatever another one is still catching up: nothing
              // before its first run is its to count.
              await this.#accrueTotal(measure, points[measure], {
                from: cursor ?? horizon,
                to: cursor === null ? horizon : (window?.to ?? horizon),
              }),
            ] as const,
        ),
      ),
    )
    return this.#applyPairs(
      entries.map((entry) => [entry[0], totalValue(entry, totals)] as const),
    )
  }

  // A total run reads its watermarks, fetches, then writes them back
  // with the totals. Runs can overlap — a settings change starts one
  // while a timer's is in flight — and the later one, fetching from a
  // watermark the earlier is about to move, would count that window
  // twice. Each run therefore waits for the one before it, whatever
  // became of that one.
  async #applyTotalsInTurn(
    facade: HomeDeviceFacade<T>,
  ): Promise<Record<string, number>> {
    const run = this.#applyTotals(facade, this.#lastTotalRun)
    this.#lastTotalRun = run
    return run
  }

  // The watermark each meter counts from: its stored one, no older than
  // the wire's retention, or `null` for a meter that has none yet.
  #liveCursors(
    measures: readonly HomeEnergyMeasureName[],
    horizon: Temporal.Instant,
  ): Map<HomeEnergyMeasureName, Temporal.Instant | null> {
    const floor = horizon.subtract(RETENTION)
    return new Map(
      measures.map((measure) => {
        const cursor = this.#storedCursor(cursorKey(measure))
        return [measure, cursor === null ? null : laterOf(cursor, floor)]
      }),
    )
  }

  #regularValue(
    [capability, measures]: EnergyEntry,
    points: MeasurePoints,
    { dayStart, now }: RegularBoundaries,
  ): number {
    const [measure = 'consumed'] = measures
    if (capability.startsWith('measure_power')) {
      return this.#strategy.watts(points[measure], now)
    }
    const today = { from: dayStart, to: now }
    if (capability.includes('cop')) {
      const consumed = sumBetween(points.consumed, today)
      return (
        sumBetween(points.produced, today) / (consumed === 0 ? 1 : consumed)
      )
    }
    return sumBetween(points[measure], today)
  }

  #storedCursor(key: string): Temporal.Instant | null {
    const raw = this.#device.getStoreValue(key)
    if (typeof raw !== 'string') {
      return null
    }
    try {
      return Temporal.Instant.from(raw)
    } catch {
      return null
    }
  }

  #storedNumber(key: string): number {
    const value = Number(this.#device.getStoreValue(key))
    return Number.isFinite(value) ? value : 0
  }
}

// The single ATA counter has no per-mode split and moves in 100 Wh
// steps, which make anything finer than a couple of hours noise: the
// reading is the average over the last closed hours — the window's Wh
// divided by its span in hours reads W. The telemetry buckets are UTC
// hours.
export const ATA_ENERGY_STRATEGY: HomeEnergyStrategy<
  typeof Home.DeviceType.Ata
> = {
  fetchPoints: async (facade, query) => {
    const { consumed } = unwrapResult(await facade.getEnergySeries(query))
    return { ...NO_POINTS, consumed: toEnergyPoints(consumed) }
  },
  watts: (points, now) => {
    const to = now.round({ roundingMode: 'floor', smallestUnit: 'hour' })
    return (
      (sumBetween(points, { from: to.subtract(POWER_WINDOW), to }) * KILO) /
      POWER_WINDOW_HOURS
    )
  },
}

// The air-to-water wire answers both directions at once and grows its
// hour in progress as it goes: the reading is the average over the last
// closed hour and what has elapsed of the current one. An hour the wire
// leaves out is an idle one, and two of them in a row read 0 W.
export const ATW_ENERGY_STRATEGY: HomeEnergyStrategy<
  typeof Home.DeviceType.Atw
> = {
  fetchPoints: async (facade, query) => {
    const { consumed, produced } = unwrapResult(
      await facade.getEnergySeries(query),
    )
    return {
      consumed: toEnergyPoints(consumed),
      produced: toEnergyPoints(produced),
    }
  },
  watts: (points, now) => {
    const hourInProgress = toHourInProgress(points, now)
    if (hourInProgress === null) {
      return 0
    }
    const from = hourInProgress.subtract(HOUR)
    return (
      (sumBetween(points, { from, to: now }) * KILO) /
      now.since(from).total({ unit: 'hours' })
    )
  },
}
