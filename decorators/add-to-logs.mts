import type { SimpleClass } from 'homey'

const FIRST_CHAR = 0
const PARENTHESES = '()'

const isFunction = (value: unknown): value is (...args: unknown[]) => unknown =>
  typeof value === 'function'

export const addToLogs =
  <T extends abstract new (...args: any[]) => SimpleClass>(...logs: string[]) =>
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
            if (this.#isKeyOfThis(log)) {
              return [this[log], '-']
            }
            if (log.endsWith(PARENTHESES)) {
              const funcName = log.slice(FIRST_CHAR, -PARENTHESES.length)
              if (
                this.#isKeyOfThis(funcName) &&
                isFunction(this[funcName]) &&
                !this[funcName].length
              ) {
                return [this[funcName].apply(this), '-']
              }
            }
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
