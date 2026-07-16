import { describe, expect, it } from 'vitest'

import { toPlainDate } from '../../lib/temporal.mts'

describe(toPlainDate, () => {
  it('should project a UTC instant into the timezone before taking the date', () => {
    expect(toPlainDate('2026-07-07T23:30:00Z', 'Europe/Paris').toString()).toBe(
      '2026-07-08',
    )
  })

  it('should take a wall-clock time as-is', () => {
    expect(toPlainDate('2026-03-18T10:00:00', 'Europe/Paris').toString()).toBe(
      '2026-03-18',
    )
  })

  it('should accept a bare date', () => {
    expect(toPlainDate('2026-03-18', 'Europe/Paris').toString()).toBe(
      '2026-03-18',
    )
  })
})
