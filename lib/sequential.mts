/**
 * Runs `run` over `items` strictly one at a time. The Homey SDK does not
 * support concurrent STRUCTURAL capability mutations (add/remove/options),
 * so those callers chain them; plain value writes stay concurrent.
 * @param items - Elements fed through `run`, one at a time in iteration order.
 * @param run - Async operation applied to each element; its promise settles before the next element starts.
 */
export const sequential = async <T,>(
  items: readonly T[],
  run: (item: T) => Promise<void>,
): Promise<void> => {
  for (const item of items) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design: the rule targets accidental serialization, and the compliant shapes (reduce chain, awaited recursion) read worse than the loop
    await run(item)
  }
}
