import type * as Home from '@olivierzal/melcloud-api/home'
import type HomeyModule from 'homey'
import {
  fanSpeedFromClassic,
  horizontalFromClassic,
  verticalFromClassic,
} from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Classic from '@olivierzal/melcloud-api/classic'

import type { InteropModule } from '../helpers.ts'
import { HomeEnergyReportAta } from '../../drivers/home-report-ata.mts'
import { ThermostatModeAta } from '../../types/ata.mts'
import {
  testEnergyReportConfig,
  testThermostatMode,
} from '../device-descriptors.ts'
import HomeMELCloudDeviceAta from '../../drivers/home-melcloud/device.mts'
import { createInstance } from './create-test-instance.ts'

vi.mock(import('@olivierzal/melcloud-api/home'), async (importOriginal) => {
  const { mock: mockModule } = await import('../helpers.ts')
  return mockModule<typeof Home>({
    ...(await importOriginal()),
    DeviceAtaFacade: vi.fn<new (...args: unknown[]) => unknown>(),
  })
})

vi.mock(import('homey'), async () => {
  const { createMockDeviceClass: create, mock: mockModule } =
    await import('../helpers.ts')
  return mockModule<InteropModule<typeof HomeyModule>>({
    default: { Device: create() },
  })
})

const mockFacade = (
  overrides: Partial<Home.DeviceAtaFacade>,
): Home.DeviceAtaFacade => overrides as Home.DeviceAtaFacade

const defineEnergyContext = (
  device: object,
  hasEnergyConsumedMeter?: boolean,
): void => {
  Object.defineProperties(device, {
    cachedFacade: {
      configurable: true,
      get: () =>
        hasEnergyConsumedMeter === undefined ? undefined : (
          { capabilities: { hasEnergyConsumedMeter } }
        ),
    },
    driver: {
      configurable: true,
      value: {
        manifest: {
          capabilities: ['meter_power', 'measure_temperature'],
        },
        tagMappings: { energy: { meter_power: ['consumed'] } },
      },
    },
  })
}

describe(HomeMELCloudDeviceAta, () => {
  let device: any

  beforeEach(() => {
    device = createInstance(HomeMELCloudDeviceAta)
  })

  testThermostatMode(() => device as object, ThermostatModeAta)

  describe('device-to-capability conversions', () => {
    it('should pass through measure_signal_strength, measure_temperature, onoff, and target_temperature', () => {
      const { deviceToCapability } = device

      expect(
        deviceToCapability.measure_signal_strength?.(mockFacade({ rssi: -42 })),
      ).toBe(-42)
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
        Classic.FanSpeed.auto,
      )
      expect(converter?.(mockFacade({ setFanSpeed: 'Three' }))).toBe(
        Classic.FanSpeed.moderate,
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
      const mapped =
        horizontalFromClassic[
          Classic.Horizontal['center' as keyof typeof Classic.Horizontal]
        ]

      expect(converter?.('center')).toBe(mapped)
    })

    it('should convert vertical using verticalFromClassic', () => {
      const {
        capabilityToDevice: { vertical: converter },
      } = device
      const mapped =
        verticalFromClassic[
          Classic.Vertical['auto' as keyof typeof Classic.Vertical]
        ]

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

  testEnergyReportConfig(() => device as object, 'energyReportRegular', {
    duration: { hours: 1 },
    mode: 'regular',
    values: { millisecond: 0, minute: 5, second: 0 },
  })

  testEnergyReportConfig(() => device as object, 'energyReportTotal', {
    duration: { hours: 1 },
    mode: 'total',
    values: { millisecond: 0, minute: 5, second: 0 },
  })

  describe('energy support gating', () => {
    it('should veto energy capabilities without a consumption meter', () => {
      defineEnergyContext(device as object, false)

      expect(device.isCapabilitySupported('meter_power')).toBe(false)
    })

    it('should serve energy capabilities when the meter is present', () => {
      defineEnergyContext(device as object, true)

      expect(device.isCapabilitySupported('meter_power')).toBe(true)
    })

    it('should trust the manifest before the facade is cached', () => {
      defineEnergyContext(device as object)

      expect(device.isCapabilitySupported('meter_power')).toBe(true)
    })

    it('should keep non-energy capabilities on manifest membership alone', () => {
      defineEnergyContext(device as object, false)

      expect(device.isCapabilitySupported('measure_temperature')).toBe(true)
      expect(device.isCapabilitySupported('unknown')).toBe(false)
    })
  })

  describe('createEnergyReport', () => {
    it('should build a Home ATA energy report', () => {
      expect(
        device.createEnergyReport({
          duration: { hours: 1 },
          mode: 'regular',
          values: { millisecond: 0, minute: 5, second: 0 },
        }),
      ).toBeInstanceOf(HomeEnergyReportAta)
    })
  })
})
