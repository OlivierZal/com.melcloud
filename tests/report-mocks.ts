import type Homey from 'homey/lib/Homey'
import { mock } from '@olivierzal/homey-kit/testing'
import { Temporal } from 'temporal-polyfill'
import { vi } from 'vitest'

// 12:00 CET in Paris = 11:00Z; the local day started at 2026-03-17T23:00Z.
export const FAKE_NOW: number = Temporal.Instant.from(
  '2026-03-18T12:00:00.000+01:00',
).epochMilliseconds

interface ReportDeviceMocks {
  readonly cleanMappingMock: ReturnType<typeof vi.fn>
  readonly clearTimeoutMock: ReturnType<typeof vi.fn>
  readonly ensureDeviceMock: ReturnType<typeof vi.fn>
  readonly homey: Homey.Homey
  readonly setCapabilityValueMock: ReturnType<typeof vi.fn>
  readonly setTimeoutMock: ReturnType<typeof vi.fn>
}

// The device seam an energy report drives is the same on both dialects:
// it writes capabilities, resolves its device, cleans its tag mapping and
// arms or cancels its timer through `homey` (whose clock and locale the
// next-run log line reads). Each suite seats its own fresh set.
export const createReportDeviceMocks = (): ReportDeviceMocks => {
  const clearTimeoutMock = vi.fn<(timeout: NodeJS.Timeout | null) => void>()
  const setTimeoutMock = vi
    .fn<(callback: () => Promise<void>, ms: number) => NodeJS.Timeout>()
    .mockReturnValue(mock<NodeJS.Timeout>())
  return {
    cleanMappingMock: vi.fn<(mapping: unknown) => Record<string, unknown>>(),
    clearTimeoutMock,
    ensureDeviceMock: vi.fn<() => Promise<unknown>>(),
    homey: mock<Homey.Homey>({
      clearTimeout: clearTimeoutMock,
      clock: mock<Homey.Homey['clock']>({
        getTimezone: vi.fn<() => string>(() => 'Europe/Paris'),
      }),
      i18n: mock<Homey.Homey['i18n']>({
        getLanguage: vi.fn<() => string>(() => 'en'),
      }),
      setTimeout: setTimeoutMock,
    }),
    setCapabilityValueMock:
      vi.fn<(capability: string, value: unknown) => Promise<void>>(),
    setTimeoutMock,
  }
}
