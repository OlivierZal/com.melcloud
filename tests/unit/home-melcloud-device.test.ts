/* eslint-disable
    @typescript-eslint/consistent-type-imports,
*/
import {
  fanSpeedFromClassic,
  Horizontal,
  horizontalFromClassic,
  Vertical,
  verticalFromClassic,
} from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThermostatModeAta } from '../../types/index.mts'
import HomeMELCloudDeviceAta from '../../drivers/home-melcloud/device.mts'

vi.mock(import('@olivierzal/melcloud-api'), async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@olivierzal/melcloud-api')>()
  return {
    ...actual,
    HomeDeviceAtaFacade: vi.fn(),
  }
})

// eslint-disable-next-line vitest/prefer-import-in-mock -- Stub class is not assignable to the full homey module type (40+ exports)
vi.mock('homey', async () => {
  const { createMockDeviceClass: create } = await import('../helpers.ts')
  return { default: { Device: create() } }
})

const { identityDecorator } = vi.hoisted(() => ({
  identityDecorator: <T>(target: T): T => target,
}))

vi.mock(import('../../decorators/add-to-logs.mts'), () => ({
  addToLogs: (): typeof identityDecorator => identityDecorator,
}))

// eslint-disable-next-line vitest/prefer-import-in-mock -- Identity function return type T is not assignable to T & TimerClass
vi.mock('../../mixins/with-timers.mts', () => ({
  withTimers: <T>(base: T): T => base,
}))

describe(HomeMELCloudDeviceAta, () => {
  let device: any

  beforeEach(() => {
    device = new (HomeMELCloudDeviceAta as unknown as new () => any)()
  })

  describe('thermostat mode configuration', () => {
    it('should be ThermostatModeAta', () => {
      expect(device.thermostatMode).toBe(ThermostatModeAta)
    })

    it('should have off support', () => {
      expect(device.thermostatMode).toHaveProperty('off')
    })
  })

  describe('deviceToCapability', () => {
    it('should be an empty object', () => {
      expect(device.deviceToCapability).toStrictEqual({})
    })
  })

  describe('capability-to-device conversions', () => {
    it('should convert fan_speed using fanSpeedFromClassic', () => {
      const {
        capabilityToDevice: { fan_speed: converter },
      } = device

      expect(converter?.(0)).toBe(
        fanSpeedFromClassic[0 as keyof typeof fanSpeedFromClassic],
      )
    })

    it('should return undefined for unknown fan_speed', () => {
      const {
        capabilityToDevice: { fan_speed: converter },
      } = device

      expect(converter?.(99)).toBeUndefined()
    })

    it('should convert horizontal using horizontalFromClassic', () => {
      const {
        capabilityToDevice: { horizontal: converter },
      } = device
      const {
        [Horizontal['center' as keyof typeof Horizontal] as Horizontal]: mapped,
      } = horizontalFromClassic

      expect(converter?.('center')).toBe(mapped)
    })

    it('should convert vertical using verticalFromClassic', () => {
      const {
        capabilityToDevice: { vertical: converter },
      } = device
      const {
        [Vertical['auto' as keyof typeof Vertical] as Vertical]: mapped,
      } = verticalFromClassic

      expect(converter?.('auto')).toBe(mapped)
    })

    it('should return undefined for unknown horizontal', () => {
      const {
        capabilityToDevice: { horizontal: converter },
      } = device

      expect(converter?.('unknown_value')).toBeUndefined()
    })

    it('should return undefined for unknown vertical', () => {
      const {
        capabilityToDevice: { vertical: converter },
      } = device

      expect(converter?.('unknown_value')).toBeUndefined()
    })

    it('should convert thermostat_mode to Home API string', () => {
      const {
        capabilityToDevice: { thermostat_mode: converter },
      } = device

      expect(converter?.('heat')).toBe('Heat')
      expect(converter?.('cool')).toBe('Cool')
      expect(converter?.('auto')).toBe('Automatic')
      expect(converter?.('dry')).toBe('Dry')
      expect(converter?.('fan')).toBe('Fan')
    })

    it('should fall back to value for unknown thermostat_mode', () => {
      const {
        capabilityToDevice: { thermostat_mode: converter },
      } = device

      expect(converter?.('unknown_mode')).toBe('unknown_mode')
    })
  })
})
