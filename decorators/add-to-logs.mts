const PARENTHESES = '()'

interface Loggable {
  /* eslint-disable @typescript-eslint/method-signature-style -- Method syntax required: class overrides are methods, not properties */
  error(...args: unknown[]): void
  log(...args: unknown[]): void
  /* eslint-enable @typescript-eslint/method-signature-style */
}

const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === 'function'

/**
 * Class decorator that prepends contextual information to log() and error() calls.
 * Each `logs` argument is resolved as: a property name (returns its value),
 * a zero-arg method name ending with '()' (calls it and returns result),
 * or a literal string (used as-is). Values are separated by '-' in the output.
 */
export const addToLogs =
  <T extends abstract new (...args: any[]) => Loggable>(...logs: string[]) =>
  (target: T, _context: ClassDecoratorContext): T => {
    abstract class LogDecorator extends target {
      public override error(...args: unknown[]): void {
        this.#commonLog('error', ...args)
      }
      public override log(...args: unknown[]): void {
        this.#commonLog('log', ...args)
      }
      #commonLog(logType: 'error' | 'log', ...args: unknown[]): void {
        super[logType](
          ...logs.flatMap((log) => {
            // Property name: return its value
            if (this.#isKeyOfThis(log)) {
              return [this[log], '-']
            }
            // Zero-arg method name ending with '()': call it and return the result
            if (log.endsWith(PARENTHESES)) {
              const functionName = log.slice(0, -PARENTHESES.length)
              if (
                this.#isKeyOfThis(functionName) &&
                isFunction(this[functionName]) &&
                this[functionName].length === 0
              ) {
                return [this[functionName].apply(this), '-']
              }
            }
            // Literal string: used as-is
            return [log, '-']
          }),
          ...args,
        )
      }
      #isKeyOfThis(value: string): value is string & keyof this {
        return value in this
      }
    }
    return LogDecorator
  }
