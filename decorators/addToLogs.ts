/* eslint-disable
  @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
*/
import type { SimpleClass } from 'homey'

const FIRST_CHAR = 0
const PARENTHESES = '()'

const addToLogs = <T extends abstract new (...args: any[]) => SimpleClass>(
  ...logs: string[]
) => (target: T, context: ClassDecoratorContext<T>): T => {
    abstract class LogsDecorator extends target {
      public error(...args: any[]): void {
        this.#commonLog('error', ...args)
      }

      public log(...args: any[]): void {
        this.#commonLog('log', ...args)
      }

      #commonLog(logType: 'error' | 'log', ...args: any[]): void {
        super[logType](
          ...logs.flatMap((log): [any, '-'] => {
            if (log in this) {
              return [this[log as keyof this], '-']
            }
            if (log.endsWith(PARENTHESES)) {
              const funcName = log.slice(FIRST_CHAR, -PARENTHESES.length)
              if (
                !(funcName in this)
                || typeof this[funcName as keyof this] !== 'function'
              ) {
                return [log, '-']
              }
              const func = this[funcName as keyof this] as (
                ...funcArgs: any[]
              ) => any
              if (!func.length) {
                return [func.call(this), '-']
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
