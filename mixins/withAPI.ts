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
import { Duration } from 'luxon'
import type MELCloudApp from '../app'
import { loginURL, type HomeyClass, type HomeySettings } from '../types'

type APIClass = new (...args: any[]) => {
  readonly api: AxiosInstance
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
    public api: AxiosInstance = axios.create()

    #retry = true

    readonly #retryTimeout!: NodeJS.Timeout

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
      const errorMessage: string = getAPIErrorMessage(error)
      this.error(`Error in ${type}:`, error.config?.url, errorMessage)
      if (error.response?.status === 401 && this.#retry) {
        this.#retry = false
        this.homey.clearTimeout(this.#retryTimeout)
        this.homey.setTimeout(
          () => {
            this.#retry = true
          },
          Duration.fromObject({ minutes: 1 }).as('milliseconds'),
        )
        const loggedIn: boolean = await (this.homey.app as MELCloudApp).login({
          username:
            (this.homey.settings.get(
              'username',
            ) as HomeySettings['username']) ?? '',
          password:
            (this.homey.settings.get(
              'password',
            ) as HomeySettings['password']) ?? '',
        })
        if (loggedIn && error.config && error.config.url !== loginURL) {
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
}
