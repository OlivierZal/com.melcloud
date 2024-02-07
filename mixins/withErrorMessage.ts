import type APICallContextData from '../lib/APICallContextData'
import type { AxiosError } from 'axios'

/* eslint-disable @typescript-eslint/no-explicit-any */
type APICallContextClass = new (...args: any[]) => APICallContextData
type APICallContextWithErrorMessageClass = new (
  ...args: any[]
) => APICallContextData & { errorMessage: string }
/* eslint-enable @typescript-eslint/no-explicit-any */

const withErrorMessage = <T extends APICallContextClass>(
  base: T,
  error: AxiosError,
): APICallContextWithErrorMessageClass =>
  class extends base {
    public readonly errorMessage: string = error.message
  }

export default withErrorMessage
