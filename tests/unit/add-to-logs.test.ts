import { describe, expect, it, vi } from 'vitest'

import { addToLogs } from '../../decorators/add-to-logs.mts'
import {
  logSpy as importedLogSpy,
  TestClassWithNonZeroArgMethod,
} from '../mock-add-to-logs-class.ts'

const logSpy = vi.fn()
const errorSpy = vi.fn()

@addToLogs('[TestClass]', 'getName()', 'id')
class TestClass {
  public readonly id = 42

  public error(...args: unknown[]): void {
    errorSpy.call(this, ...args)
  }

  public getName(): string {
    return 'MyDevice'
  }

  public log(...args: unknown[]): void {
    logSpy.call(this, ...args)
  }
}

describe(addToLogs, () => {
  it('should prepend resolved values to log calls', () => {
    logSpy.mockClear()
    const instance = new TestClass()
    instance.log('hello')

    expect(logSpy).toHaveBeenCalledWith(
      '[TestClass]',
      '-',
      'MyDevice',
      '-',
      42,
      '-',
      'hello',
    )
  })

  it('should fall back to literal string when decorated name refers to a function with parameters', () => {
    importedLogSpy.mockClear()
    const instance = new TestClassWithNonZeroArgMethod()
    instance.log('test')

    expect(importedLogSpy).toHaveBeenCalledWith('getLabel()', '-', 'test')
  })

  it('should prepend resolved values to error calls', () => {
    errorSpy.mockClear()
    const instance = new TestClass()
    instance.error('something went wrong')

    expect(errorSpy).toHaveBeenCalledWith(
      '[TestClass]',
      '-',
      'MyDevice',
      '-',
      42,
      '-',
      'something went wrong',
    )
  })
})
