export const createInstance = <T>(
  constructor: abstract new (...args: never[]) => T,
): T => new (constructor as unknown as new () => T)()
