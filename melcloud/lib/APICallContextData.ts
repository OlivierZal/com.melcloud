import type { InternalAxiosRequestConfig } from 'axios'

const ORDER = [
  'dataType',
  'method',
  'url',
  'params',
  'headers',
  'requestData',
  'responseData',
  'status',
  'errorMessage',
]

const SPACE = 2

export default abstract class APICallContextData {
  public readonly method: InternalAxiosRequestConfig['method']

  public readonly params: InternalAxiosRequestConfig['params']

  public readonly url: InternalAxiosRequestConfig['url']

  public constructor(config?: InternalAxiosRequestConfig) {
    this.method = config?.method?.toUpperCase()
    this.url = config?.url
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.params = config?.params
  }

  public toString(): string {
    return ORDER.map((key) => {
      if (key in this) {
        const value = this[key as keyof this]
        if (typeof value !== 'undefined') {
          return `${key}: ${
            typeof value === 'object' ?
              JSON.stringify(value, null, SPACE)
            : String(value)
          }`
        }
      }
      return null
    })
      .filter((line) => line !== null)
      .join('\n')
  }
}
