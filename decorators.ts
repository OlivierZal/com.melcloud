/* eslint-disable
  @typescript-eslint/no-unsafe-assignment,
  @typescript-eslint/no-explicit-any
*/
interface HasGetName {
  getName(): string
}

export default function logName<
  This extends HasGetName,
  Args extends [string, '-', ...any[]],
  Return,
>(
  originalMethod: (this: This, ...args: Args) => Return,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: ClassMethodDecoratorContext<
    This,
    (this: This, ...args: any[]) => Return
  >,
) {
  function replacementMethod(this: This, ...args: any[]) {
    return originalMethod.call(
      this,
      ...([this.getName(), '-', ...args] as Args),
    )
  }
  return replacementMethod
}
