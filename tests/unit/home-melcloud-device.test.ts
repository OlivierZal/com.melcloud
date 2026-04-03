/* eslint-disable
    @typescript-eslint/consistent-type-imports,
*/
import {
  type HomeDeviceAtaFacade,
  FanSpeed,
  fanSpeedFromClassic,
  Horizontal,
  horizontalFromClassic,
  Vertical,
  verticalFromClassic,
} from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThermostatModeAta } from '../../types/index.mts'
import { testThermostatMode } from '../helpers.ts'
import HomeMELCloudDeviceAta from '../../drivers/home-melcloud/device.mts'
import { createInstance } from './create-test-instance.ts'

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

const mockFacade = (
  overrides: Partial<HomeDeviceAtaFacade>,
): HomeDeviceAtaFacade => overrides as HomeDeviceAtaFacade

describe(HomeMELCloudDeviceAta, () => {
  let device: any

  beforeEach(() => {
    device = createInstance(HomeMELCloudDeviceAta)
  })

  testThermostatMode(() => device as object, ThermostatModeAta)

  describe('device-to-capability conversions', () => {
    it('should pass through measure_temperature, onoff, and target_temperature', () => {
      const { deviceToCapability } = device

      expect(
        deviceToCapability.measure_temperature?.(
          mockFacade({ roomTemperature: 21 }),
        ),
      ).toBe(21)
      expect(deviceToCapability.onoff?.(mockFacade({ power: true }))).toBe(true)
      expect(
        deviceToCapability.target_temperature?.(
          mockFacade({ setTemperature: 22 }),
        ),
      ).toBe(22)
    })

    it('should convert fan speed from Home string to classic number', () => {
      const {
        deviceToCapability: { fan_speed: converter },
      } = device

      expect(converter?.(mockFacade({ setFanSpeed: 'Auto' }))).toBe(
        FanSpeed.auto,
      )
      expect(converter?.(mockFacade({ setFanSpeed: 'Three' }))).toBe(
        FanSpeed.moderate,
      )
    })

    it('should convert horizontal direction from Home string to classic key', () => {
      const {
        deviceToCapability: { horizontal: converter },
      } = device

      expect(converter?.(mockFacade({ vaneHorizontalDirection: 'Auto' }))).toBe(
        'auto',
      )
      expect(
        converter?.(mockFacade({ vaneHorizontalDirection: 'Centre' })),
      ).toBe('center')
    })

    it('should convert vertical direction from Home string to classic key', () => {
      const {
        deviceToCapability: { vertical: converter },
      } = device

      expect(converter?.(mockFacade({ vaneVerticalDirection: 'Auto' }))).toBe(
        'auto',
      )
      expect(converter?.(mockFacade({ vaneVerticalDirection: 'Swing' }))).toBe(
        'swing',
      )
    })

    it('should convert thermostat_mode to key when power is on', () => {
      const {
        deviceToCapability: { thermostat_mode: converter },
      } = device

      expect(
        converter?.(mockFacade({ operationMode: 'Heat', power: true })),
      ).toBe('heat')
      expect(
        converter?.(mockFacade({ operationMode: 'Automatic', power: true })),
      ).toBe('auto')
    })

    it('should return off for thermostat_mode when power is off', () => {
      const {
        deviceToCapability: { thermostat_mode: converter },
      } = device

      expect(
        converter?.(mockFacade({ operationMode: 'Heat', power: false })),
      ).toBe(ThermostatModeAta.off)
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
  })
})
