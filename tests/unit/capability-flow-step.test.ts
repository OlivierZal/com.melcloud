import { describe, expect, it } from 'vitest'

import { getCapabilityFlowStep } from '../../lib/capability-flow-step.mts'
import targetTemperature from '../../vendor/capabilities/target_temperature.json' with { type: 'json' }

describe(getCapabilityFlowStep, () => {
  it('should read the step the vendored capability states', () => {
    // The value Athom states for `target_temperature`; the drift test
    // over `vendor/capabilities/` is what keeps this current.
    expect(getCapabilityFlowStep(targetTemperature)).toBe(0.5)
  })

  it('should yield nothing for a capability stating no step', () => {
    expect(getCapabilityFlowStep({})).toBeUndefined()
    expect(getCapabilityFlowStep({ $flow: {} })).toBeUndefined()
    expect(getCapabilityFlowStep({ $flow: { actions: [] } })).toBeUndefined()
    expect(
      getCapabilityFlowStep({ $flow: { actions: [{ args: [] }] } }),
    ).toBeUndefined()
    expect(
      getCapabilityFlowStep({ $flow: { actions: [{ args: [{}] }] } }),
    ).toBeUndefined()
  })
})
