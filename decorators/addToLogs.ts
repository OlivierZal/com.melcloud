import type { LogClass } from '../types'

export default function addToLogs<T extends LogClass>(...logs: string[]) {
  return function actualDecorator(
    target: T,
    context: ClassDecoratorContext,
  ): LogClass & T {
    abstract class LogsDecorator extends target {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      public error(...args: any[]): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.commonLog('error', ...args)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      public log(...args: any[]): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        this.commonLog('log', ...args)
      }

      /* eslint-disable @typescript-eslint/no-explicit-any */
      private commonLog(logType: 'error' | 'log', ...args: any[]): void {
        /* eslint-disable @typescript-eslint/no-unsafe-argument */
        super[logType](
          ...logs.flatMap((log: string): [any, '-'] => {
            if (log.endsWith('()')) {
              const funcName: string = log.slice(0, -2)
              const func: () => any = (this as Record<any, any>)[
                funcName
              ] as () => any
              if (typeof func === 'function' && !func.length) {
                return [func.call(this), '-']
              }
            }
            if (log in this) {
              return [(this as Record<any, any>)[log], '-']
            }
            return [log, '-']
          }),
          ...args,
        )
        /* eslint-enable @typescript-eslint/no-unsafe-argument */
      }
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    Object.defineProperty(LogsDecorator, 'name', {
      value: context.name,
    })
    return LogsDecorator
  }
}
