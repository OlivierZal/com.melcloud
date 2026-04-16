import { describe, expect, expectTypeOf, it } from 'vitest'
import * as Classic from '@olivierzal/melcloud-api/classic'

describe('atw operation state types', () => {
  describe('hot water operation mode state', () => {
    it('should have all expected states', () => {
      expect(Classic.OperationModeStateHotWater).toStrictEqual({
        dhw: 'dhw',
        idle: 'idle',
        legionella: 'legionella',
        prohibited: 'prohibited',
      })
    })

    it('should produce string literal values usable as Homey capability values', () => {
      const states = Object.values(Classic.OperationModeStateHotWater)

      for (const state of states) {
        expectTypeOf(state).toBeString()

        expect(state.length).toBeGreaterThan(0)
      }
    })
  })

  describe('zone operation mode state', () => {
    it('should have all expected states', () => {
      expect(Classic.OperationModeStateZone).toStrictEqual({
        cooling: 'cooling',
        defrost: 'defrost',
        heating: 'heating',
        idle: 'idle',
        prohibited: 'prohibited',
      })
    })

    it('should produce string literal values usable as Homey capability values', () => {
      const states = Object.values(Classic.OperationModeStateZone)

      for (const state of states) {
        expectTypeOf(state).toBeString()

        expect(state.length).toBeGreaterThan(0)
      }
    })
  })

  describe('hot water state transitions', () => {
    it('should cover all hot water operational states', () => {
      const allStates = new Set(
        Object.values(Classic.OperationModeStateHotWater),
      )

      expect(allStates).toContain('dhw')
      expect(allStates).toContain('idle')
      expect(allStates).toContain('legionella')
      expect(allStates).toContain('prohibited')
      expect(allStates.size).toBe(4)
    })
  })

  describe('zone state transitions', () => {
    it('should cover all zone operational states', () => {
      const allStates = new Set(Object.values(Classic.OperationModeStateZone))

      expect(allStates).toContain('cooling')
      expect(allStates).toContain('defrost')
      expect(allStates).toContain('heating')
      expect(allStates).toContain('idle')
      expect(allStates).toContain('prohibited')
      expect(allStates.size).toBe(5)
    })
  })
})
