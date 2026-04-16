import { describe, expect, it } from 'vitest'
import * as Classic from '@olivierzal/melcloud-api/classic'

import {
  horizontalFromDevice,
  operationModeFromDevice,
  verticalFromDevice,
} from '../../types/ata.mts'

describe('facade interaction patterns', () => {
  describe('reverse mapping with as-const enums', () => {
    it('should resolve Classic.DeviceType values', () => {
      expect(Classic.DeviceType.Ata).toBe(Classic.DeviceType.Ata)
      expect(Classic.DeviceType.Atw).toBe(Classic.DeviceType.Atw)
      expect(Classic.DeviceType.Erv).toBe(Classic.DeviceType.Erv)
    })

    it('should reverse-map Classic.Horizontal values', () => {
      expect(horizontalFromDevice[Classic.Horizontal.auto]).toBe('auto')
      expect(horizontalFromDevice[Classic.Horizontal.center]).toBe('center')
      expect(horizontalFromDevice[Classic.Horizontal.swing]).toBe('swing')
    })

    it('should reverse-map Classic.Vertical values', () => {
      expect(verticalFromDevice[Classic.Vertical.auto]).toBe('auto')
      expect(verticalFromDevice[Classic.Vertical.upwards]).toBe('upwards')
      expect(verticalFromDevice[Classic.Vertical.swing]).toBe('swing')
    })

    it('should reverse-map Classic.OperationMode values', () => {
      expect(operationModeFromDevice[Classic.OperationMode.auto]).toBe('auto')
      expect(operationModeFromDevice[Classic.OperationMode.cool]).toBe('cool')
      expect(operationModeFromDevice[Classic.OperationMode.heat]).toBe('heat')
    })

    it('should forward-map from key to value', () => {
      expect(Classic.Horizontal.auto).toBe(Classic.Horizontal.auto)
      expect(Classic.OperationMode.cool).toBe(Classic.OperationMode.cool)
      expect(Classic.Vertical.swing).toBe(Classic.Vertical.swing)
    })
  })
})
