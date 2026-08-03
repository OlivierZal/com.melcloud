import type HomeyModule from 'homey'
import { describe, expect, it, vi } from 'vitest'

import type { InteropModule } from '../helpers.ts'
import { App, Device, Driver } from '../../lib/homey.mts'

const { appBase, deviceBase, driverBase } = vi.hoisted(() => ({
  appBase: vi.fn<() => void>(),
  deviceBase: vi.fn<() => void>(),
  driverBase: vi.fn<() => void>(),
}))

vi.mock(import('homey'), async () => {
  const { mock: mockModule } = await import('../helpers.ts')
  return mockModule<InteropModule<typeof HomeyModule>>({
    default: { App: appBase, Device: deviceBase, Driver: driverBase },
  })
})

describe('homey re-exports', () => {
  it.each([
    ['App', App, appBase],
    ['Device', Device, deviceBase],
    ['Driver', Driver, driverBase],
  ])('should re-export %s from the homey SDK', (_name, reExported, base) => {
    expect(reExported).toBe(base)
  })
})
