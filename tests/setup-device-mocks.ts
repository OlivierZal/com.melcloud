import { vi } from 'vitest'

vi.mock(import('../drivers/base-report.mts'), async () => {
  const { createEnergyReportMock } = await import('./helpers.ts')
  return createEnergyReportMock()
})
