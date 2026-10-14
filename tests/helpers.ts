import { vi } from 'vitest'

// The report classes are constructed (`new EnergyReport(device, config)`
// from a device's `energyReports.create`), so the double is a `new`-able
// function expression — vitest refuses `mockReturnValue` under `new`, and
// arrows are not constructible.
const newEnergyReportMock = function newEnergyReportMock(): {
  start: () => Promise<void>
  unschedule: () => void
} {
  return {
    start: vi.fn<() => Promise<void>>().mockResolvedValue(),
    unschedule: vi.fn<() => void>(),
  }
}

export const createEnergyReportMock = (): {
  EnergyReport: ReturnType<typeof vi.fn>
} => ({ EnergyReport: vi.fn<typeof newEnergyReportMock>(newEnergyReportMock) })

export { createMockDeviceClass } from './mock-device-class.ts'
export { createMockDriverClass } from './mock-driver-class.ts'
