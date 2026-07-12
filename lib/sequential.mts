/**
 * Runs `run` over `items` strictly one at a time. The Homey SDK does not
 * support concurrent capability mutations, so the callers chain them.
 */
export const sequential = async <T,>(
  items: readonly T[],
  run: (item: T) => Promise<void>,
): Promise<void> => {
  const step = async (iterator: Iterator<T>): Promise<void> => {
    const result = iterator.next()
    if (result.done === true) {
      return
    }
    await run(result.value)
    await step(iterator)
  }
  await step(items[Symbol.iterator]())
}
