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
import type MELCloudApp from '../app'
import { loginURL, type HomeyClass, type HomeySettings } from '../types'

type APIClass = new (...args: any[]) => { readonly api: AxiosInstance }

const HTTP_STATUS_UNAUTHORIZED = 401

const getAPIErrorMessage = (error: AxiosError): string => error.message

export const getErrorMessage = (error: unknown): string => {
  let errorMessage = String(error)
  if (axios.isAxiosError(error)) {
    errorMessage = getAPIErrorMessage(error)
  } else if (error instanceof Error) {
    errorMessage = error.message
  }
  return errorMessage
}

const withAPI = <T extends HomeyClass>(base: T): APIClass & T =>
  class extends base {
    public api: AxiosInstance = axios.create()

    public constructor(...args: any[]) {
      super(...args)
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
          'contextKey',
        ) as HomeySettings['contextKey']) ?? ''
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
      const errorMessage: string = getAPIErrorMessage(error)
      this.error(`Error in ${type}:`, error.config?.url, errorMessage)
      const app: MELCloudApp = this.homey.app as MELCloudApp
      if (
        error.response?.status === HTTP_STATUS_UNAUTHORIZED &&
        app.retry &&
        error.config?.url !== loginURL
      ) {
        app.handleRetry()
        const loggedIn: boolean = await app.login()
        if (loggedIn && error.config) {
          return this.api.request(error.config)
        }
      }
      await this.setErrorWarning(errorMessage)
      return Promise.reject(error)
    }

    private async setErrorWarning(warning: string | null): Promise<void> {
      if (this.setWarning) {
        await this.setWarning(warning)
      }
    }
  }

export default withAPI
