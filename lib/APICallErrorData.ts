import withErrorMessage, {
  type APICallContextDataWithErrorMessage,
} from '../mixins/withErrorMessage'
import APICallRequestData from './APICallRequestData'
import APICallResponseData from './APICallResponseData'
import type { AxiosError } from 'axios'

const createAPICallErrorData = (
  error: AxiosError,
): APICallContextDataWithErrorMessage =>
  typeof error.response === 'undefined'
    ? new (withErrorMessage(APICallRequestData, error))(error.config)
    : new (withErrorMessage(APICallResponseData, error))(error.response)

export default createAPICallErrorData
