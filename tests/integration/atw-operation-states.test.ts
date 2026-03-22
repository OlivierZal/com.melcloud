import {
  OperationModeStateHotWater,
  OperationModeStateZone,
} from '@olivierzal/melcloud-api'
import { describe, expect, expectTypeOf, it } from 'vitest'

describe('aTW operation state types', () => {
  describe('operationModeStateHotWater', () => {
    it('should have all expected states', () => {
      expect(OperationModeStateHotWater).toStrictEqual({
        dhw: 'dhw',
        idle: 'idle',
        legionella: 'legionella',
        prohibited: 'prohibited',
      })
    })

    it('should produce string literal values usable as Homey capability values', () => {
      const states = Object.values(OperationModeStateHotWater)

      for (const state of states) {
        expectTypeOf(state).toBeString()

        expect(state.length).toBeGreaterThan(0)
      }
    })
  })

  describe('operationModeStateZone', () => {
    it('should have all expected states', () => {
      expect(OperationModeStateZone).toStrictEqual({
        cooling: 'cooling',
        defrost: 'defrost',
        heating: 'heating',
        idle: 'idle',
        prohibited: 'prohibited',
      })
    })

    it('should produce string literal values usable as Homey capability values', () => {
      const states = Object.values(OperationModeStateZone)

      for (const state of states) {
        expectTypeOf(state).toBeString()

        expect(state.length).toBeGreaterThan(0)
      }
    })
  })

  describe('hot water state transitions', () => {
    it('should cover all hot water operational states', () => {
      const allStates = new Set(Object.values(OperationModeStateHotWater))

      expect(allStates).toContain('dhw')
      expect(allStates).toContain('idle')
      expect(allStates).toContain('legionella')
      expect(allStates).toContain('prohibited')
      expect(allStates.size).toBe(4)
    })
  })

  describe('zone state transitions', () => {
    it('should cover all zone operational states', () => {
      const allStates = new Set(Object.values(OperationModeStateZone))

      expect(allStates).toContain('cooling')
      expect(allStates).toContain('defrost')
      expect(allStates).toContain('heating')
      expect(allStates).toContain('idle')
      expect(allStates).toContain('prohibited')
      expect(allStates.size).toBe(5)
    })
  })
})
