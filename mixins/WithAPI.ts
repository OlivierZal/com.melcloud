/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type Homey from 'homey/lib/Homey'
import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { type HomeySettings } from '../types'

type APIClass = new (...args: any[]) => {
  error(...errorArgs: any[]): void
  log(...logArgs: any[]): void
  homey: Homey
}

export default function WithAPI<T extends APIClass>(Base: T) {
  return class extends Base {
    api: AxiosInstance

    private constructor(...args: any[]) {
      super(...args)
      this.api = axios.create()
      this.setupAxiosInterceptors()
    }

    private setupAxiosInterceptors() {
      this.api.interceptors.request.use(
        (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig =>
          this.handleRequest(config),
        (error: AxiosError): Promise<AxiosError> =>
          this.handleError('request', error),
      )
      this.api.interceptors.response.use(
        (response: AxiosResponse): AxiosResponse =>
          this.handleResponse(response),
        (error: AxiosError): Promise<AxiosError> =>
          this.handleError('response', error),
      )
    }

    private handleRequest(
      config: InternalAxiosRequestConfig,
    ): InternalAxiosRequestConfig {
      const updatedConfig: InternalAxiosRequestConfig = { ...config }
      updatedConfig.headers['X-MitsContextKey'] =
        (this.homey.settings.get(
          'ContextKey',
        ) as HomeySettings['ContextKey']) ?? ''
      this.log(
        'Sending request:',
        updatedConfig.url,
        updatedConfig.method === 'post' ? updatedConfig.data : '',
      )
      return updatedConfig
    }

    private handleResponse(response: AxiosResponse): AxiosResponse {
      this.log('Received response:', response.config.url, response.data)
      return response
    }

    private handleError(
      type: 'request' | 'response',
      error: AxiosError,
    ): Promise<AxiosError> {
      this.error(
        `Error in ${type}:`,
        error.config?.url,
        error.response ? error.response.data : error,
      )
      return Promise.reject(error)
    }
  }
}
