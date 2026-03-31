import {
  DeviceType,
  Horizontal,
  OperationMode,
  Vertical,
} from '@olivierzal/melcloud-api'
import { describe, expect, it } from 'vitest'

import {
  horizontalReverse,
  operationModeReverse,
  verticalReverse,
} from '../../types/index.mts'

describe('facade interaction patterns', () => {
  describe('reverse mapping with as-const enums', () => {
    it('should resolve DeviceType values', () => {
      expect(DeviceType.Ata).toBe(DeviceType.Ata)
      expect(DeviceType.Atw).toBe(DeviceType.Atw)
      expect(DeviceType.Erv).toBe(DeviceType.Erv)
    })

    it('should reverse-map Horizontal values', () => {
      expect(horizontalReverse[Horizontal.auto]).toBe('auto')
      expect(horizontalReverse[Horizontal.center]).toBe('center')
      expect(horizontalReverse[Horizontal.swing]).toBe('swing')
    })

    it('should reverse-map Vertical values', () => {
      expect(verticalReverse[Vertical.auto]).toBe('auto')
      expect(verticalReverse[Vertical.upwards]).toBe('upwards')
      expect(verticalReverse[Vertical.swing]).toBe('swing')
    })

    it('should reverse-map OperationMode values', () => {
      expect(operationModeReverse[OperationMode.auto]).toBe('auto')
      expect(operationModeReverse[OperationMode.cool]).toBe('cool')
      expect(operationModeReverse[OperationMode.heat]).toBe('heat')
    })

    it('should forward-map from key to value', () => {
      expect(Horizontal.auto).toBe(Horizontal.auto)
      expect(OperationMode.cool).toBe(OperationMode.cool)
      expect(Vertical.swing).toBe(Vertical.swing)
    })
  })
})
