import type APICallContextData from './APICallContextData'
import type { AxiosError } from 'axios'

export interface APICallContextDataWithErrorMessage extends APICallContextData {
  readonly errorMessage: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withErrorMessage = <T extends new (...args: any[]) => APICallContextData>(
  base: T,
  error: AxiosError,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): new (...args: any[]) => APICallContextDataWithErrorMessage =>
  class extends base {
    public readonly errorMessage: string = error.message
  }

export default withErrorMessage
