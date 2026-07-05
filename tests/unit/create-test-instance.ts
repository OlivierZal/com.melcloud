export const createInstance = <T>(
  instanceConstructor: abstract new (...args: never[]) => T,
): T => new (instanceConstructor as unknown as new () => T)()
