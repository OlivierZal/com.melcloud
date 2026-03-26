import { describe, expect, it } from 'vitest'

import { isTotalEnergyKey, KILOWATT_TO_WATT } from '../../lib/index.mts'

describe('energy report lifecycle', () => {
  describe('kilowatt to watt conversion', () => {
    it('should convert kW to W correctly', () => {
      const kilowatts = 1.5
      const watts = kilowatts * KILOWATT_TO_WATT

      expect(watts).toBe(1500)
    })

    it('should handle zero correctly', () => {
      expect(0 * KILOWATT_TO_WATT).toBe(0)
    })
  })

  describe(isTotalEnergyKey, () => {
    it('should identify total energy keys', () => {
      expect(isTotalEnergyKey('meter_power')).toBe(true)
      expect(isTotalEnergyKey('meter_power.cooling')).toBe(true)
      expect(isTotalEnergyKey('meter_power.cop')).toBe(true)
    })

    it('should reject non-total energy keys', () => {
      expect(isTotalEnergyKey('meter_power.daily')).toBe(false)
      expect(isTotalEnergyKey('meter_power.daily_cooling')).toBe(false)
      expect(isTotalEnergyKey('measure_power')).toBe(false)
    })
  })
})
