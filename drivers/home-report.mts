import type * as Home from '@olivierzal/melcloud-api/home'
import { Temporal } from 'temporal-polyfill'

import type { HomeEnergyMeasureName } from '../types/device.mts'
import type { HomeDeviceFacade } from '../types/home.mts'
import { isTotalEnergyKey } from '../lib/is-total-energy-key.mts'
import { getNow } from '../lib/temporal.mts'
import { typedEntries, typedFromEntries } from '../lib/typed-object.mts'
import type { HomeMELCloudDevice } from './home-device.mts'
import {
  type EnergyReportConfig,
  ScheduledEnergyReport,
} from './base-report.mts'

// Live-probed telemetry semantics (melcloud-api CLAUDE.md, 2026-07-17):
// Minute-grade buckets are near-live (~1-2 min lag) and sparse — only
// active periods return points, so an empty window means an idle unit.
export const TELEMETRY_INTERVAL = 'Minute'
export const MINUTES_PER_HOUR = 60
export const WATTS_PER_KILOWATT = 1000
// ATA telemetry is Wh pulses (100 Wh quantum); ATW buckets are kWh.
export const WATT_HOURS_PER_KILOWATT_HOUR = 1000
// The single ATA counter has no per-mode split and no live power: the
// approximated reading is a coarse average over this trailing window.
export const POWER_WINDOW_HOURS = 2
export const POWER_WINDOW: Temporal.DurationLike = {
  hours: POWER_WINDOW_HOURS,
}
// A bucket older than this horizon means the unit stopped: report 0 W.
export const POWER_FRESHNESS: Temporal.DurationLike = { minutes: 3 }
// Buckets land up to ~2 min late: totals only accrue up to this safety
// margin so a late bucket can never be skipped by an advanced cursor.
const CURSOR_SAFETY: Temporal.DurationLike = { minutes: 15 }
// 'YYYY-MM-DD HH:MM:SS' prefix of the wire's nanosecond-padded times.
const WIRE_TIME_SECONDS_LENGTH = 19

type EnergyEntry = readonly [string, readonly HomeEnergyMeasureName[]]

type MeasurePoints = Partial<
  Record<HomeEnergyMeasureName, readonly EnergyPoint[]>
>

interface RegularBoundaries {
  readonly dayStart: Temporal.Instant
  readonly now: Temporal.Instant
}

export interface EnergyPoint {
  readonly instant: Temporal.Instant
  readonly value: number
}

export interface HomeEnergyQuery {
  readonly from: string
  readonly measure: HomeEnergyMeasureName
  readonly to: string
}

// Per-type telemetry dialect: how to fetch a measure's points, convert wire
// sums to kWh, and derive an instantaneous power reading. Injected by the
// concrete reports so the engine stays type-agnostic.
export interface HomeEnergyStrategy<T extends Home.DeviceType> {
  readonly fetchPoints: (
    facade: HomeDeviceFacade<T>,
    query: HomeEnergyQuery,
  ) => Promise<EnergyPoint[]>
  readonly kilowattHours: (wireSum: number) => number
  readonly watts: (
    points: readonly EnergyPoint[],
    now: Temporal.Instant,
  ) => number
}

const cursorKey = (measure: HomeEnergyMeasureName): string =>
  `energy_cursor_${measure}`
const totalKey = (measure: HomeEnergyMeasureName): string =>
  `energy_total_${measure}`

// Wire times are UTC wall-clock strings with nanosecond padding
// ('2026-07-15 07:00:00.000000000'); non-finite values count as 0 like the
// Classic report's tags.
export const parsePoints = (data: Home.EnergyData): EnergyPoint[] =>
  (data.measureData[0]?.values ?? []).map(({ time, value }) => {
    const numeric = Number(value)
    return {
      instant: Temporal.Instant.from(
        `${time.slice(0, WIRE_TIME_SECONDS_LENGTH).replace(' ', 'T')}Z`,
      ),
      value: Number.isFinite(numeric) ? numeric : 0,
    }
  })

export const sumSince = (
  points: readonly EnergyPoint[],
  boundary: Temporal.Instant,
): number => {
  let sum = 0
  for (const { instant, value } of points) {
    if (Temporal.Instant.compare(instant, boundary) >= 0) {
      sum += value
    }
  }
  return sum
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

export abstract class HomeEnergyReport<
  T extends Home.DeviceType,
> extends ScheduledEnergyReport {
  readonly #device: HomeMELCloudDevice<T>

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

  protected constructor(
    device: HomeMELCloudDevice<T>,
    config: EnergyReportConfig,
    strategy: HomeEnergyStrategy<T>,
  ) {
    super(device, config)
    this.#device = device
    this.#strategy = strategy
  }

  protected override async fetchAndApply(): Promise<void> {
    const facade = await this.#device.ensureDevice()
    if (facade === null) {
      return
    }
    await (this.mode === 'total' ?
      this.#applyTotals(facade)
    : this.#applyRegular(facade))
  }

  protected override hasEnabledCapabilities(): boolean {
    return this.#enabledEntries.length > 0
  }

  // Monotonic app-side meters: the Home API keeps ~3 months of telemetry
  // (with a mixed-semantics past), so lifetime totals accrue locally from a
  // persisted cursor — downtime is caught up on the next run.
  async #accrueTotal(
    facade: HomeDeviceFacade<T>,
    measure: HomeEnergyMeasureName,
    upTo: Temporal.Instant,
  ): Promise<number> {
    const storedTotal = this.#storedNumber(totalKey(measure))
    const cursor = this.#storedCursor(cursorKey(measure))
    const accrued =
      cursor !== null && Temporal.Instant.compare(cursor, upTo) < 0 ?
        await this.#fetchAccrual(facade, { cursor, measure, upTo })
      : 0
    const total = storedTotal + accrued
    await this.#device.setStoreValue(totalKey(measure), total)
    await this.#device.setStoreValue(cursorKey(measure), upTo.toString())
    return total
  }

  async #applyRegular(facade: HomeDeviceFacade<T>): Promise<void> {
    const entries = this.#enabledEntries
    const now = getNow(this.#device.homey)
    const nowInstant = now.toInstant()
    const dayStart = now.startOfDay().toInstant()
    const powerStart = nowInstant.subtract(POWER_WINDOW)
    const from =
      Temporal.Instant.compare(dayStart, powerStart) <= 0 ?
        dayStart
      : powerStart
    const points = await this.#fetchMeasurePoints(facade, entries, {
      from,
      to: nowInstant,
    })
    await Promise.all(
      entries.map(async (entry) =>
        this.#device.setCapabilityValue(
          entry[0],
          this.#regularValue(entry, points, {
            dayStart,
            now: nowInstant,
          }),
        ),
      ),
    )
  }

  async #applyTotals(facade: HomeDeviceFacade<T>): Promise<void> {
    const entries = this.#enabledEntries
    const upTo = getNow(this.#device.homey).toInstant().subtract(CURSOR_SAFETY)
    const totals = typedFromEntries(
      await Promise.all(
        uniqueMeasures(entries).map(
          async (measure) =>
            [measure, await this.#accrueTotal(facade, measure, upTo)] as const,
        ),
      ),
    )
    await Promise.all(
      entries.map(async (entry) =>
        this.#device.setCapabilityValue(entry[0], totalValue(entry, totals)),
      ),
    )
  }

  async #fetchAccrual(
    facade: HomeDeviceFacade<T>,
    {
      cursor,
      measure,
      upTo,
    }: {
      readonly cursor: Temporal.Instant
      readonly measure: HomeEnergyMeasureName
      readonly upTo: Temporal.Instant
    },
  ): Promise<number> {
    const points = await this.#strategy.fetchPoints(facade, {
      from: cursor.toString(),
      measure,
      to: upTo.toString(),
    })
    // The fetch window re-includes the cursor's own bucket: only
    // strictly-later points accrue, so no pulse counts twice.
    let sum = 0
    for (const { instant, value } of points) {
      if (
        Temporal.Instant.compare(instant, cursor) > 0 &&
        Temporal.Instant.compare(instant, upTo) <= 0
      ) {
        sum += value
      }
    }
    return this.#strategy.kilowattHours(sum)
  }

  async #fetchMeasurePoints(
    facade: HomeDeviceFacade<T>,
    entries: readonly EnergyEntry[],
    window: { readonly from: Temporal.Instant; readonly to: Temporal.Instant },
  ): Promise<MeasurePoints> {
    return typedFromEntries(
      await Promise.all(
        uniqueMeasures(entries).map(
          async (measure) =>
            [
              measure,
              await this.#strategy.fetchPoints(facade, {
                from: window.from.toString(),
                measure,
                to: window.to.toString(),
              }),
            ] as const,
        ),
      ),
    )
  }

  #regularValue(
    [capability, measures]: EnergyEntry,
    points: MeasurePoints,
    { dayStart, now }: RegularBoundaries,
  ): number {
    const [measure = 'consumed'] = measures
    if (capability.startsWith('measure_power')) {
      return this.#strategy.watts(points[measure] ?? [], now)
    }
    if (capability.includes('cop')) {
      const consumed = sumSince(points.consumed ?? [], dayStart)
      return (
        sumSince(points.produced ?? [], dayStart) /
        (consumed === 0 ? 1 : consumed)
      )
    }
    return this.#strategy.kilowattHours(
      sumSince(points[measure] ?? [], dayStart),
    )
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
