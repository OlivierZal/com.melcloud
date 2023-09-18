/* eslint-disable @typescript-eslint/no-unsafe-argument */
interface GetNameClass {
  getName(): string
}

export default function logName<T extends GetNameClass>(
  originalMethod: (...args: any[]) => void,
  _context: unknown, // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  function replacementMethod(this: T, ...args: any[]) {
    originalMethod.call(this, this.getName(), '-', ...args)
  }
  return replacementMethod
}
