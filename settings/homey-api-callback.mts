import type Homey from 'homey/lib/HomeySettings'

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

// Wraps Homey's callback-based settings API in a Promise for async/await usage
export const homeyApiGet = async <T,>(
  homey: Homey,
  path: string,
): Promise<T> =>
  new Promise((resolve, reject) => {
    homey.api('GET', path, (error: Error | null, data: T) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })

export const homeyApiPut = async <T,>(
  homey: Homey,
  path: string,
  body: unknown,
): Promise<T> =>
  new Promise((resolve, reject) => {
    homey.api('PUT', path, body, (error: Error | null, data: T) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })

export const homeyApiPost = async <T,>(
  homey: Homey,
  path: string,
  body: unknown,
): Promise<T> =>
  new Promise((resolve, reject) => {
    homey.api('POST', path, body, (error: Error | null, data: T) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })
