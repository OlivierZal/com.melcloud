import { vi } from 'vitest'

import { addToLogs } from '../decorators/add-to-logs.mts'

const logSpy = vi.fn()
const errorSpy = vi.fn()

@addToLogs('getLabel()')
class TestClassWithNonZeroArgMethod {
  readonly #label = 'label'

  public error(...args: unknown[]): void {
    errorSpy.call(this, ...args)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Parameter needed for function arity check, argsIgnorePattern doesn't match
  public getLabel(_prefix: string): string {
    return this.#label
  }

  public log(...args: unknown[]): void {
    logSpy.call(this, ...args)
  }
}

export { errorSpy, logSpy, TestClassWithNonZeroArgMethod }
