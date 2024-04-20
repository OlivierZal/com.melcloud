import type { SimpleClass } from 'homey'

const FIRST_CHAR = 0
const PARENTHESES = '()'

const addToLogs =
  <
    T extends abstract new (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...args: any[]
    ) => SimpleClass,
  >(
    ...logs: string[]
  ) =>
  (target: T, context: ClassDecoratorContext<T>): T => {
    abstract class LogsDecorator extends target {
      public error(...args: unknown[]): void {
        this.#commonLog('error', ...args)
      }

      public log(...args: unknown[]): void {
        this.#commonLog('log', ...args)
      }

      #commonLog(logType: 'error' | 'log', ...args: unknown[]): void {
        super[logType](
          ...logs.flatMap((log): [unknown, '-'] => {
            if (log in this) {
              return [this[log as keyof this], '-']
            }
            if (log.endsWith(PARENTHESES)) {
              const funcName = log.slice(FIRST_CHAR, -PARENTHESES.length)
              if (
                funcName in this &&
                typeof this[funcName as keyof this] !== 'function'
              ) {
                const func = this[funcName as keyof this] as (
                  ...funcArgs: unknown[]
                ) => unknown
                if (!func.length) {
                  return [func.call(this), '-']
                }
              }
            }
            return [log, '-']
          }),
          ...args,
        )
      }
    }

    Object.defineProperty(LogsDecorator, 'name', { value: context.name })
    return LogsDecorator
  }

export default addToLogs
