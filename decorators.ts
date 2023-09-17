/* eslint-disable
  @typescript-eslint/no-explicit-any,
  @typescript-eslint/no-unsafe-call,
  @typescript-eslint/no-unsafe-member-access,
  @typescript-eslint/no-unsafe-return,
  @typescript-eslint/no-unused-vars
*/
export default function logName<This, Args extends any[], Return>(
  originalMethod: any,
  _context: ClassMethodDecoratorContext,
) {
  function replacementMethod(this: any, ...args: any[]) {
    return originalMethod.call(this, this.getName(), '-', ...args)
  }
  return replacementMethod
}
