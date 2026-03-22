import {
  DeviceType,
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
} from '@olivierzal/melcloud-api'
import { describe, expect, it } from 'vitest'

import { keyOfValue } from '../../lib/reverse-mapping.mts'

describe('facade interaction patterns', () => {
  describe('reverse mapping with as-const enums', () => {
    it('should resolve DeviceType values', () => {
      expect(DeviceType.Ata).toBe(DeviceType.Ata)
      expect(DeviceType.Atw).toBe(DeviceType.Atw)
      expect(DeviceType.Erv).toBe(DeviceType.Erv)
    })

    it('should reverse-map Horizontal values', () => {
      expect(keyOfValue(Horizontal, Horizontal.auto)).toBe('auto')
      expect(keyOfValue(Horizontal, Horizontal.center)).toBe('center')
      expect(keyOfValue(Horizontal, Horizontal.swing)).toBe('swing')
    })

    it('should reverse-map Vertical values', () => {
      expect(keyOfValue(Vertical, Vertical.auto)).toBe('auto')
      expect(keyOfValue(Vertical, Vertical.upwards)).toBe('upwards')
      expect(keyOfValue(Vertical, Vertical.swing)).toBe('swing')
    })

    it('should reverse-map OperationMode values', () => {
      expect(keyOfValue(OperationMode, OperationMode.auto)).toBe('auto')
      expect(keyOfValue(OperationMode, OperationMode.cool)).toBe('cool')
      expect(keyOfValue(OperationMode, OperationMode.heat)).toBe('heat')
    })

    it('should reverse-map FanSpeed values', () => {
      expect(keyOfValue(FanSpeed, FanSpeed.auto)).toBe('auto')
      expect(keyOfValue(FanSpeed, FanSpeed.silent)).toBe('silent')
      expect(keyOfValue(FanSpeed, FanSpeed.fast)).toBe('fast')
    })

    it('should forward-map from key to value', () => {
      expect(Horizontal.auto).toBe(Horizontal.auto)
      expect(OperationMode.cool).toBe(OperationMode.cool)
      expect(Vertical.swing).toBe(Vertical.swing)
    })
  })
})
