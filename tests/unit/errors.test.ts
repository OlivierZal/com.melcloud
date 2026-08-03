import { describe, expect, it } from 'vitest'

import { NotFoundError } from '../../lib/errors.mts'

describe(NotFoundError, () => {
  it('should be an Error carrying the NotFoundError name', () => {
    const error = new NotFoundError('missing')

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('NotFoundError')
    expect(error.message).toBe('missing')
  })
})
