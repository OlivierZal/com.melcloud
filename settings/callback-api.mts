import type Homey from 'homey/lib/HomeySettings'

// The settings SDK's `homey.api`/`homey.confirm` are error-first
// callbacks (unlike the widget SDK's promise-returning `homey.api`), so
// the settings pages share one promisification primitive and per-verb
// wrappers over it. Byte-identical copies of this module live in the
// sibling Homey apps — edit them together.
export const homeyCallback = async <T,>(
  call: (callback: (error: Error | null, result: T) => void) => void,
): Promise<T> =>
  new Promise((resolve, reject) => {
    call((error, result) => {
      if (error !== null) {
        reject(error)
        return
      }
      resolve(result)
    })
  })

export const homeyApiDelete = async (
  homey: Homey,
  path: string,
): Promise<void> =>
  homeyCallback((callback) => {
    homey.api('DELETE', path, callback)
  })

export const homeyApiGet = async <T,>(homey: Homey, path: string): Promise<T> =>
  homeyCallback((callback) => {
    homey.api('GET', path, callback)
  })

export const homeyApiPost = async <T,>(
  homey: Homey,
  path: string,
  body: unknown,
): Promise<T> =>
  homeyCallback((callback) => {
    homey.api('POST', path, body, callback)
  })

export const homeyApiPut = async <T,>(
  homey: Homey,
  path: string,
  body: unknown,
): Promise<T> =>
  homeyCallback((callback) => {
    homey.api('PUT', path, body, callback)
  })

export const homeyConfirm = async (
  homey: Homey,
  message: string,
): Promise<boolean> =>
  homeyCallback((callback) => {
    homey.confirm(message, null, callback)
  })
