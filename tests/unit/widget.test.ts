import type HomeyWidget from 'homey/lib/HomeyWidget'
import { describe, expect, it, vi } from 'vitest'

import { homeyApiGet, homeyApiPost, homeyApiPut } from '../../public/widget.mts'
import { mock } from '../helpers.ts'

const createWidgetHomey = (
  result?: unknown,
): {
  api: ReturnType<
    typeof vi.fn<
      (method: string, path: string, body?: object) => Promise<unknown>
    >
  >
  homey: HomeyWidget
} => {
  const api = vi
    .fn<(method: string, path: string, body?: object) => Promise<unknown>>()
    .mockResolvedValue(result)
  return { api, homey: mock<HomeyWidget>({ api }) }
}

describe('widget transport', () => {
  it('should read a route through GET', async () => {
    const { api, homey } = createWidgetHomey(['a'])

    await expect(
      homeyApiGet<string[]>(homey, '/language'),
    ).resolves.toStrictEqual(['a'])
    expect(api).toHaveBeenCalledWith('GET', '/language')
  })

  it('should post a body', async () => {
    const { api, homey } = createWidgetHomey()
    await homeyApiPost(homey, '/boot-error', { name: 'X' })

    expect(api).toHaveBeenCalledWith('POST', '/boot-error', { name: 'X' })
  })

  it('should put a body', async () => {
    const { api, homey } = createWidgetHomey()
    await homeyApiPut(homey, '/classic/zones/devices/1/ata', { Power: true })

    expect(api).toHaveBeenCalledWith('PUT', '/classic/zones/devices/1/ata', {
      Power: true,
    })
  })
})
