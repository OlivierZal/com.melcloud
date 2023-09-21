/* eslint-disable @typescript-eslint/no-unsafe-argument */
type LogClass = abstract new (...args: any[]) => {
  getName(): string
  error(...errorArgs: any[]): void
  log(...logArgs: any[]): void
}

export default function addNameToLogs<T extends LogClass>(
  BaseClass: T,
  _context: ClassDecoratorContext, // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  abstract class AddNameToLogsClass extends BaseClass {
    error(...args: any[]): void {
      this.logWithName('error', ...args)
    }

    log(...args: any[]): void {
      this.logWithName('log', ...args)
    }

    logWithName(logType: 'error' | 'log', ...args: any[]): void {
      super[logType](this.getName(), '-', ...args)
    }
  }
  return AddNameToLogsClass
}
