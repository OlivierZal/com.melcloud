import APICallContextData from './APICallContextData'
import type { InternalAxiosRequestConfig } from 'axios'

export default class APICallRequestData extends APICallContextData {
  public readonly headers?: InternalAxiosRequestConfig['headers']

  public readonly dataType = 'API request'

  public readonly requestData: InternalAxiosRequestConfig['data']

  public constructor(config?: InternalAxiosRequestConfig) {
    super(config)
    this.headers = config?.headers
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.requestData = config?.data
  }
}
