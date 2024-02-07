import type APICallContextData from './APICallContextData'
import APICallRequestData from './APICallRequestData'
import APICallResponseData from './APICallResponseData'
import type { AxiosError } from 'axios'
import withErrorMessage from '../mixins/withErrorMessage'

const createAPICallErrorData = (
  error: AxiosError,
): APICallContextData & { errorMessage: string } =>
  typeof error.response === 'undefined'
    ? new (withErrorMessage(APICallRequestData, error))(error.config)
    : new (withErrorMessage(APICallResponseData, error))(error.response)

export default createAPICallErrorData
