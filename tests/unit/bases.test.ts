import { describe, expect, it } from 'vitest'

import { type LocalizedStrings, localizeWithAffix } from '../../types/bases.mts'
import { mock } from '../helpers.ts'

describe(localizeWithAffix, () => {
  it('should join every affix language with its base string', () => {
    const result = localizeWithAffix(
      { en: 'Temperature', fr: 'Température' },
      { en: 'Flow', fr: 'Départ' },
      'suffix',
    )

    expect(result).toStrictEqual({
      en: 'Temperature Flow',
      fr: 'Température Départ',
    })
  })

  it('should lowercase the base after a prefix', () => {
    const result = localizeWithAffix(
      { en: 'Temperature' },
      { en: 'Outdoor' },
      'prefix',
    )

    expect(result).toStrictEqual({ en: 'Outdoor temperature' })
  })

  it('should fall back to the English base for a language the base lacks', () => {
    const result = localizeWithAffix(
      { en: 'Temperature' },
      { en: 'Flow', fr: 'Départ' },
      'suffix',
    )

    expect(result.fr).toBe('Temperature Départ')
  })

  it('should fall back to the English affix for an explicitly undefined entry', () => {
    const result = localizeWithAffix(
      { en: 'Temperature', fr: 'Température' },
      mock<LocalizedStrings>({ en: 'Flow', fr: undefined }),
      'suffix',
    )

    expect(result.fr).toBe('Température Flow')
  })
})
