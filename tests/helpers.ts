import { vi } from 'vitest'

export const createEnergyReportMock = (): {
  EnergyReport: ReturnType<typeof vi.fn>
} => ({
  EnergyReport: vi
    .fn<() => { start: () => Promise<void>; unschedule: () => void }>()
    .mockImplementation(() => ({
      start: vi.fn<() => Promise<void>>().mockResolvedValue(),
      unschedule: vi.fn<() => void>(),
    })),
})

export { createMockDeviceClass } from './mock-device-class.ts'
export { createMockDriverClass } from './mock-driver-class.ts'
