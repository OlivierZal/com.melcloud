/* eslint-disable @typescript-eslint/no-unsafe-argument */
interface HasGetName {
  getName(): string
}

export default function logName<This extends HasGetName, Return>(
  originalMethod: (this: This, ...args: any[]) => Return,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: ClassMethodDecoratorContext<
    This,
    (this: This, ...args: any[]) => Return
  >,
) {
  function replacementMethod(this: This, ...args: any[]) {
    return originalMethod.call(this, this.getName(), '-', ...args)
  }
  return replacementMethod
}
