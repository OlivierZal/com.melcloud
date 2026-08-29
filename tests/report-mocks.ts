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
  readonly setCapabilityValueMock: ReturnType<typeof vi.fn>
  readonly setTimeoutMock: ReturnType<typeof vi.fn>
}

// The device seam an energy report drives is the same on both dialects:
// it writes capabilities, resolves its device, cleans its tag mapping and
// schedules its next run. Each suite seats its own fresh set.
export const createReportDeviceMocks = (): ReportDeviceMocks => ({
  cleanMappingMock: vi.fn<(mapping: unknown) => Record<string, unknown>>(),
  clearTimeoutMock: vi.fn<(timeout: NodeJS.Timeout | null) => void>(),
  ensureDeviceMock: vi.fn<() => Promise<unknown>>(),
  setCapabilityValueMock:
    vi.fn<(capability: string, value: unknown) => Promise<void>>(),
  setTimeoutMock: vi
    .fn<
      (
        callback: () => Promise<void>,
        interval: unknown,
        actionType: string,
      ) => number
    >()
    .mockReturnValue(1),
})
