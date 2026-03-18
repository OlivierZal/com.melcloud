// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
export const mock = <T>(overrides: Partial<T> = {}): T => overrides as T
