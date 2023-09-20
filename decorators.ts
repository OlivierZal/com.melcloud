/* eslint-disable
  @typescript-eslint/no-explicit-any,
  @typescript-eslint/no-unsafe-argument
*/
export default function addToLog(...logs: string[]) {
  return function actualDecorator<T extends Record<string, () => any>>(
    originalMethod: (...args: any[]) => void,
    _context: ClassMethodDecoratorContext, // eslint-disable-line @typescript-eslint/no-unused-vars
  ) {
    return function replacementMethod(this: T, ...args: any[]) {
      originalMethod.call(
        this,
        ...logs
          .filter((log: string) => log)
          .flatMap((log: string): [any, '-'] => {
            if (log.endsWith('()')) {
              const func: string = log.slice(0, -2)
              if (typeof this[func] === 'function' && !this[func].length) {
                return [this[func](), '-']
              }
            }
            if (log in this) {
              return [this[log], '-']
            }
            return [log, '-']
          }),
        ...args,
      )
    }
  }
}
