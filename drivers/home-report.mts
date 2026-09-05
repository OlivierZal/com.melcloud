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

// The app's cadence choice over the library's typed interval
// vocabulary: minute buckets are near-live and sparse — an empty
// window means an idle unit — where the coarser grains would lag the
// power readings.
export const TELEMETRY_INTERVAL: Home.EnergyInterval = 'Minute'
export const MINUTES_PER_HOUR = 60
// The single ATA counter has no per-mode split and no live power: the
// approximated reading is a coarse average over this trailing window.
export const POWER_WINDOW_HOURS = 2
export const POWER_WINDOW: Temporal.DurationLike = { hours: POWER_WINDOW_HOURS }
// A bucket older than this horizon means the unit stopped: report 0 W.
export const POWER_FRESHNESS: Temporal.DurationLike = { minutes: 3 }
// Buckets land up to ~2 min late: totals only accrue up to this safety
// margin so a late bucket can never be skipped by an advanced cursor.
const CURSOR_SAFETY: Temporal.DurationLike = { minutes: 15 }

type EnergyEntry = readonly [string, readonly HomeEnergyMeasureName[]]

interface HomeEnergyQuery {
  readonly from: string
  readonly measure: HomeEnergyMeasureName
  readonly to: string
}

// Per-type strategy over the library's normalized kWh series: how to
// fetch a measure's points (ATW selects a direction, ATA has none) and
// derive an instantaneous power reading. Injected by the concrete
// reports so the engine stays type-agnostic.
interface HomeEnergyStrategy<T extends Home.DeviceType> {
  readonly fetchPoints: (
    facade: HomeDeviceFacade<T>,
    query: HomeEnergyQuery,
  ) => Promise<EnergyPoint[]>
  readonly watts: (
    points: readonly EnergyPoint[],
    now: Temporal.Instant,
  ) => number
}

type MeasurePoints = Partial<
  Record<HomeEnergyMeasureName, readonly EnergyPoint[]>
>

interface RegularBoundaries {
  readonly dayStart: Temporal.Instant
  readonly now: Temporal.Instant
}

// One bucketable sample: the library's epoch-ms stamp as an instant,
// its energy in kWh whatever the device type.
export interface EnergyPoint {
  readonly instant: Temporal.Instant
  readonly value: number
}

const cursorKey = (measure: HomeEnergyMeasureName): string =>
  `energy_cursor_${measure}`
const totalKey = (measure: HomeEnergyMeasureName): string =>
  `energy_total_${measure}`

// The library owns the whole telemetry decode (stamps, units, garbled
// samples); what remains here is window policy over its degraded
// fields: a `null` energy counts as 0 like the Classic report's tags,
// and a sample without an instant cannot join any window, so it is
// dropped.
export const toEnergyPoints = (
  points: readonly Home.EnergySeriesPoint[],
): EnergyPoint[] =>
  points.flatMap(({ atEpochMs, kilowattHours }) =>
    atEpochMs === null
      ? []
      : [
          {
            instant: Temporal.Instant.fromEpochMilliseconds(atEpochMs),
            value: kilowattHours ?? 0,
          },
        ],
  )

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

  protected override async fetchAndApply(): Promise<Record<
    string,
    number
  > | null> {
    const facade = await this.#device.ensureDevice()
    if (facade === null) {
      return null
    }
    return this.mode === 'total'
      ? this.#applyTotals(facade)
      : this.#applyRegular(facade)
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
      cursor !== null && Temporal.Instant.compare(cursor, upTo) < 0
        ? await this.#fetchAccrual(facade, { cursor, measure, upTo })
        : 0
    const total = storedTotal + accrued
    await this.#device.setStoreValue(totalKey(measure), total)
    await this.#device.setStoreValue(cursorKey(measure), upTo.toString())
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
    const from =
      Temporal.Instant.compare(dayStart, powerStart) <= 0
        ? dayStart
        : powerStart
    const points = await this.#fetchMeasurePoints(facade, entries, {
      from,
      to: nowInstant,
    })
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
  ): Promise<Record<string, number>> {
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
    return this.#applyPairs(
      entries.map((entry) => [entry[0], totalValue(entry, totals)] as const),
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
    return sum
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
    return sumSince(points[measure] ?? [], dayStart)
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
