import type { ErrorLogEntry } from '@olivierzal/melcloud-api'
import { describe, expect, it } from 'vitest'

import { describeOpenFault } from '../../lib/unit-fault.mts'

const entry = (overrides: Partial<ErrorLogEntry>): ErrorLogEntry => ({
  at: '2026-11-18T15:00:00',
  atEpochMs: 1,
  code: 'E6',
  deviceId: 'home-1',
  ...overrides,
})

const withoutCode = (message?: string): ErrorLogEntry => ({
  at: '2026-11-18T15:00:00',
  atEpochMs: 1,
  deviceId: 'home-1',
  ...(message !== undefined && { message }),
})

describe(describeOpenFault, () => {
  it('should word the newest entry not yet cleared as code and reason', () => {
    expect(
      describeOpenFault([
        entry({ atEpochMs: 3, clearedAt: '2026-11-18T16:00:00', code: 'P8' }),
        entry({ atEpochMs: 1, code: 'E1', message: 'Older' }),
        entry({ atEpochMs: 2, message: 'Communication error' }),
      ]),
    ).toBe('E6 : Communication error')
  })

  it('should give the code alone when the log gives no reason', () => {
    expect(describeOpenFault([entry({})])).toBe('E6')
  })

  it('should give the reason alone when the log gives no code', () => {
    expect(describeOpenFault([withoutCode('Sensor')])).toBe('Sensor')
  })

  it('should give nothing for an entry with neither', () => {
    expect(describeOpenFault([withoutCode()])).toBeNull()
  })

  it('should rank an entry without an instant last', () => {
    expect(
      describeOpenFault([
        entry({ atEpochMs: null, code: 'U1' }),
        entry({ atEpochMs: 5, code: 'E6' }),
      ]),
    ).toBe('E6')
  })

  it('should give nothing when every entry is cleared', () => {
    expect(
      describeOpenFault([entry({ clearedAt: '2026-11-18T16:00:00' })]),
    ).toBeNull()
    expect(describeOpenFault([])).toBeNull()
  })
})
