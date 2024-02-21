import APICallContextData from './APICallContextData'
import type { InternalAxiosRequestConfig } from 'axios'

export default class APICallRequestData extends APICallContextData {
  public readonly headers?: InternalAxiosRequestConfig['headers']

  public readonly data: InternalAxiosRequestConfig['data']

  public readonly dataType: string = 'API request'

  public constructor(config?: InternalAxiosRequestConfig) {
    super(config)
    this.headers = config?.headers
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.data = config?.data
  }
}
