import APICallContextData from './APICallContextData'
import type { AxiosResponse } from 'axios'

export default class APICallResponseData extends APICallContextData {
  public readonly dataType: string = 'API response'

  public readonly headers?: AxiosResponse['headers']

  public readonly status?: AxiosResponse['status']

  public readonly data: AxiosResponse['data']

  public constructor(response?: AxiosResponse) {
    super(response?.config)
    this.headers = response?.headers
    this.status = response?.status
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.data = response?.data
  }
}
