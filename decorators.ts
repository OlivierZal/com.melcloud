/* eslint-disable @typescript-eslint/no-unsafe-argument */
interface HasGetNameClass {
  getName(): string
}

export default function logName<T extends HasGetNameClass>(
  originalMethod: (...args: any[]) => void,
  _context: unknown, // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  function replacementMethod(this: T, ...args: any[]) {
    originalMethod.call(this, this.getName(), '-', ...args)
  }
  return replacementMethod
}
