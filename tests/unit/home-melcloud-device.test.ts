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
      const converter = device.capabilityToDevice.fan_speed

      expect(converter?.(0)).toBe(
        fanSpeedFromClassic[0 as keyof typeof fanSpeedFromClassic],
      )
    })

    it('should return undefined for unknown fan_speed', () => {
      const converter = device.capabilityToDevice.fan_speed

      expect(converter?.(99)).toBeUndefined()
    })

    it('should convert horizontal using horizontalFromClassic', () => {
      const converter = device.capabilityToDevice.horizontal
      const mapped =
        horizontalFromClassic[
          Horizontal['center' as keyof typeof Horizontal] as Horizontal
        ]

      expect(converter?.('center')).toBe(mapped)
    })

    it('should convert vertical using verticalFromClassic', () => {
      const converter = device.capabilityToDevice.vertical
      const mapped =
        verticalFromClassic[
          Vertical['auto' as keyof typeof Vertical] as Vertical
        ]

      expect(converter?.('auto')).toBe(mapped)
    })

    it('should return undefined for unknown horizontal', () => {
      const converter = device.capabilityToDevice.horizontal

      expect(converter?.('unknown_value')).toBeUndefined()
    })

    it('should return undefined for unknown vertical', () => {
      const converter = device.capabilityToDevice.vertical

      expect(converter?.('unknown_value')).toBeUndefined()
    })

    it('should convert thermostat_mode to Home API string', () => {
      const converter = device.capabilityToDevice.thermostat_mode

      expect(converter?.('heat')).toBe('Heat')
      expect(converter?.('cool')).toBe('Cool')
      expect(converter?.('auto')).toBe('Automatic')
      expect(converter?.('dry')).toBe('Dry')
      expect(converter?.('fan')).toBe('Fan')
    })

    it('should fall back to value for unknown thermostat_mode', () => {
      const converter = device.capabilityToDevice.thermostat_mode

      expect(converter?.('unknown_mode')).toBe('unknown_mode')
    })
  })
})
