import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import APICallContextData from './APICallContextData'

export default class APICallResponseData extends APICallContextData {
  public readonly headers?: AxiosResponse['headers']

  public readonly status?: AxiosResponse['status']

  public readonly dataType = 'API response'

  public readonly requestData: InternalAxiosRequestConfig['data']

  public readonly responseData: AxiosResponse['data']

  public constructor(response?: AxiosResponse) {
    super(response?.config)
    this.headers = response?.headers
    this.status = response?.status
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.requestData = response?.config.data
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.responseData = response?.data
  }
}
