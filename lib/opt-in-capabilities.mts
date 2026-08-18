// Signal strength stays manifest-declared but opt-in through the shared
// options settings group on every driver: both default-capability
// consumers (pairing details, init reconciliation) exclude it through
// this one filter, so the per-driver required lists need not.
export const withoutOptInCapabilities = (
  capabilities: readonly string[],
): string[] =>
  capabilities.filter((capability) => capability !== 'measure_signal_strength')
