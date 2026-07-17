import { vi } from 'vitest'

vi.mock(import('../drivers/classic-report.mts'), async () => {
  const { createEnergyReportMock } = await import('./helpers.ts')
  return createEnergyReportMock()
})
