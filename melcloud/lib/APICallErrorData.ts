import type APICallContextData from './APICallContextData'
import APICallRequestData from './APICallRequestData'
import APICallResponseData from './APICallResponseData'
import type { AxiosError } from 'axios'

interface APICallContextDataWithErrorMessage extends APICallContextData {
  readonly errorMessage: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withErrorMessage = <T extends new (...args: any[]) => APICallContextData>(
  base: T,
  error: AxiosError,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): new (...args: any[]) => APICallContextDataWithErrorMessage =>
  class extends base {
    public readonly errorMessage = error.message
  }

const createAPICallErrorData = (
  error: AxiosError,
): APICallContextDataWithErrorMessage =>
  typeof error.response === 'undefined'
    ? new (withErrorMessage(APICallRequestData, error))(error.config)
    : new (withErrorMessage(APICallResponseData, error))(error.response)

export default createAPICallErrorData
