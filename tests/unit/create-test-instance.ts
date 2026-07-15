export const createInstance = <T>(
  instanceConstructor: abstract new (...args: never[]) => T,
): T => {
  const concrete = instanceConstructor as unknown as new () => T
  return new concrete()
}
