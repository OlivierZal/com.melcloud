/* eslint-disable @typescript-eslint/no-unsafe-argument */
interface GetNameClass {
  getName(): string
}

export default function logName<T extends GetNameClass>(
  originalMethod: (this: T, ...args: any[]) => void,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: unknown,
) {
  function replacementMethod(this: T, ...args: any[]) {
    originalMethod.call(this, this.getName(), '-', ...args)
  }
  return replacementMethod
}
