/**
 * The UI step a node-homey-lib capability states, read from the range
 * argument of its flow action.
 *
 * `target_temperature` declares no root `step` — only `decimals: 1` —
 * so its flow argument is the one place Athom states a granularity for
 * it (0.5). Reading a flow-action field as a UI grid IS an inference,
 * and a deliberate one: the value is Athom's own for this capability,
 * and the vendored copy sits under the drift test in
 * `tests/unit/capability-definitions.test.ts`, so an upstream change
 * surfaces here instead of rotting silently. A capability stating none
 * yields `undefined`, and every consumer falls back to its own
 * default.
 * @param capability - A vendored capability definition.
 * @param capability.$flow - Its flow-card declarations, if any.
 * @returns The stated step, or `undefined` when the capability has none.
 */
export const getCapabilityFlowStep = (capability: {
  readonly $flow?:
    | {
        readonly actions?:
          | readonly { readonly args?: readonly { step?: number }[] }[]
          | undefined
      }
    | undefined
}): number | undefined => capability.$flow?.actions?.[0]?.args?.[0]?.step
