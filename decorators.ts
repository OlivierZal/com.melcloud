/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type BaseMELCloudDevice from './bases/device'

export default function addDeviceNameToLogs<
  T extends abstract new (...args: any[]) => BaseMELCloudDevice,
>(
  BaseClass: T,
  _context: ClassDecoratorContext, // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  abstract class AddDeviceNameToLogsClass extends BaseClass {
    error(...args: any[]): void {
      this.customLog('error', ...args)
    }

    log(...args: any[]): void {
      this.customLog('log', ...args)
    }

    customLog(logType: 'error' | 'log', ...args: any[]): void {
      super[logType](this.getName(), '-', ...args)
    }
  }
  return AddDeviceNameToLogsClass
}
