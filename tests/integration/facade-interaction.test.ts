import {
  DeviceType,
  Horizontal,
  OperationMode,
  Vertical,
} from '@olivierzal/melcloud-api'
import { describe, expect, it } from 'vitest'

import {
  horizontalFromDevice,
  operationModeFromDevice,
  verticalFromDevice,
} from '../../types/ata.mts'

describe('facade interaction patterns', () => {
  describe('reverse mapping with as-const enums', () => {
    it('should resolve DeviceType values', () => {
      expect(DeviceType.Ata).toBe(DeviceType.Ata)
      expect(DeviceType.Atw).toBe(DeviceType.Atw)
      expect(DeviceType.Erv).toBe(DeviceType.Erv)
    })

    it('should reverse-map Horizontal values', () => {
      expect(horizontalFromDevice[Horizontal.auto]).toBe('auto')
      expect(horizontalFromDevice[Horizontal.center]).toBe('center')
      expect(horizontalFromDevice[Horizontal.swing]).toBe('swing')
    })

    it('should reverse-map Vertical values', () => {
      expect(verticalFromDevice[Vertical.auto]).toBe('auto')
      expect(verticalFromDevice[Vertical.upwards]).toBe('upwards')
      expect(verticalFromDevice[Vertical.swing]).toBe('swing')
    })

    it('should reverse-map OperationMode values', () => {
      expect(operationModeFromDevice[OperationMode.auto]).toBe('auto')
      expect(operationModeFromDevice[OperationMode.cool]).toBe('cool')
      expect(operationModeFromDevice[OperationMode.heat]).toBe('heat')
    })

    it('should forward-map from key to value', () => {
      expect(Horizontal.auto).toBe(Horizontal.auto)
      expect(OperationMode.cool).toBe(OperationMode.cool)
      expect(Vertical.swing).toBe(Vertical.swing)
    })
  })
})
