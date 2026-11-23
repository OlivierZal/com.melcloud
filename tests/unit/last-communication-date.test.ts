import { describe, expect, it } from 'vitest'

import { formatLastCommunicationDate } from '../../lib/last-communication-date.mts'

describe(formatLastCommunicationDate, () => {
  // The stamp is the building's own wall clock, so its date is the one
  // the owner lived: no zone is applied to it.
  it.each([
    { expected: 'May 3, 2026', locale: 'en' },
    { expected: '3 mai 2026', locale: 'fr' },
    { expected: '3. mai 2026', locale: 'no' },
    { expected: '3. Mai 2026', locale: 'de' },
  ])(
    'spells the date of the stamp the way $locale reads dates',
    ({ expected, locale }) => {
      expect(formatLastCommunicationDate('2026-05-03T23:58:00', locale)).toBe(
        expected,
      )
    },
  )

  it.each([
    ['a stamp that cannot be read', 'not a date'],
    ['no stamp at all', undefined],
    [
      'the year-one stamp of a unit that never communicated',
      '0001-01-01T00:00:00',
    ],
  ])('answers null for %s', (_label, stamp) => {
    expect(formatLastCommunicationDate(stamp, 'en')).toBeNull()
  })
})
