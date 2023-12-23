/* eslint-disable
  @typescript-eslint/no-explicit-any,
  @typescript-eslint/no-unsafe-argument
*/
import type { SimpleClass } from 'homey'
import { EMPTY_FUNCTION_PARENS } from '../constants'

const addToLogs = <T extends abstract new (...args: any[]) => SimpleClass>(
  ...logs: string[]
) =>
  function actualDecorator(target: T, context: ClassDecoratorContext<T>): T {
    abstract class LogsDecorator extends target {
      public error(...args: any[]): void {
        this.commonLog('error', ...args)
      }

      public log(...args: any[]): void {
        this.commonLog('log', ...args)
      }

      private commonLog(logType: 'error' | 'log', ...args: any[]): void {
        super[logType](
          ...logs.flatMap((log: string): [any, '-'] => {
            if (log.endsWith(EMPTY_FUNCTION_PARENS)) {
              const funcName: string = log.slice(
                0,
                -EMPTY_FUNCTION_PARENS.length,
              )
              const func: () => any = (this as Record<any, any>)[
                funcName
              ] as () => any
              if (typeof func === 'function' && !func.length) {
                return [func.call(this), '-']
              }
            }
            if (log in this) {
              return [this[log as keyof LogsDecorator], '-']
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
