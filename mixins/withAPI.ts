/* eslint-disable
  @typescript-eslint/no-explicit-any,
  @typescript-eslint/no-unsafe-argument
*/
import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import type { HomeyClass, HomeySettings } from '../types'

type APIClass = new (...args: any[]) => {
  api: AxiosInstance
}

function getAPIErrorMessage(error: AxiosError): string {
  return error.message
}

export function getErrorMessage(error: unknown): string {
  let errorMessage = String(error)
  if (axios.isAxiosError(error)) {
    errorMessage = getAPIErrorMessage(error)
  } else if (error instanceof Error) {
    errorMessage = error.message
  }
  return errorMessage
}

export default function withAPI<T extends HomeyClass>(base: T): APIClass & T {
  return class extends base {
    public api: AxiosInstance

    public constructor(...args: any[]) {
      super(...args)
      this.api = axios.create()
      this.setupAxiosInterceptors()
    }

    private setupAxiosInterceptors(): void {
      this.api.interceptors.request.use(
        (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig =>
          this.handleRequest(config),
        async (error: AxiosError): Promise<AxiosError> =>
          this.handleError('request', error),
      )
      this.api.interceptors.response.use(
        (response: AxiosResponse): AxiosResponse =>
          this.handleResponse(response),
        async (error: AxiosError): Promise<AxiosError> =>
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

    private async handleError(
      type: 'request' | 'response',
      error: AxiosError,
    ): Promise<AxiosError> {
      this.error(
        `Error in ${type}:`,
        error.config?.url,
        getAPIErrorMessage(error),
      )
      await this.setErrorWarning(error)
      return Promise.reject(error)
    }

    private async setErrorWarning(error: AxiosError): Promise<void> {
      if (!this.setWarning) {
        return
      }
      await this.setWarning(getAPIErrorMessage(error))
    }
  }
}
