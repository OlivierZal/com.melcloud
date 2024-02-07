import type { InternalAxiosRequestConfig } from 'axios'

const ORDER: string[] = [
  'dataType',
  'method',
  'url',
  'params',
  'headers',
  'data',
  'status',
  'errorMessage',
]

export default abstract class APICallContextData {
  public readonly method: InternalAxiosRequestConfig['method']

  public readonly url: InternalAxiosRequestConfig['url']

  public readonly params: InternalAxiosRequestConfig['params']

  public constructor(config?: InternalAxiosRequestConfig) {
    this.method = config?.method?.toUpperCase()
    this.url = config?.url
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.params = config?.params
  }

  public toString(): string {
    return ORDER.map((key: string): string | null => {
      if (key in this) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const value: any = this[key as keyof this]
        if (typeof value !== 'undefined') {
          return `${key}: ${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}`
        }
      }
      return null
    })
      .filter((line: string | null) => line !== null)
      .join('\n')
  }
}
