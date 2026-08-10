// @vitest-environment happy-dom
// @vitest-environment-options {"settings": {"disableCSSFileLoading": true, "disableJavaScriptFileLoading": true, "navigation": {"disableMainFrameNavigation": true}}}

import { beforeEach, describe, expect, it } from 'vitest'

import { watchWidgetFreshness } from '../../public/webview-freshness-boot.mts'
import { createWidgetHomey } from '../ata-group-harness.ts'
import { settleDetached } from '../helpers.ts'

const ENTRY = 'ata-group-setting'

const stampPage = (hash: string): void => {
  const script = document.createElement('script')
  script.setAttribute('src', `index.js?v=${hash}`)
  document.head.append(script)
}

const hashRoutes = (hash: string): Record<string, unknown> => ({
  'GET /webview-hashes': { [ENTRY]: hash },
})

describe('widget freshness boot', () => {
  beforeEach(() => {
    sessionStorage.clear()
    document.head.replaceChildren()
  })

  it('should keep an unstamped page booting without any fetch', async () => {
    const { api, homey } = createWidgetHomey({ routes: hashRoutes('aaaaaaaa') })

    await expect(watchWidgetFreshness(homey, ENTRY)).resolves.toBe(false)

    expect(api).not.toHaveBeenCalledWith('GET', '/webview-hashes')
  })

  it('should keep a matching page booting', async () => {
    stampPage('aaaaaaaa')
    const { homey } = createWidgetHomey({ routes: hashRoutes('aaaaaaaa') })

    await expect(watchWidgetFreshness(homey, ENTRY)).resolves.toBe(false)
  })

  it('should report a mismatch that survived its refetch', async () => {
    stampPage('aaaaaaaa')
    // The guard already carries this identity: the one refetch was spent.
    sessionStorage.setItem('webview_refetched_for', 'aaaaaaaa')
    const { api, homey } = createWidgetHomey({ routes: hashRoutes('bbbbbbbb') })

    await expect(watchWidgetFreshness(homey, ENTRY)).resolves.toBe(false)

    await settleDetached()

    expect(api).toHaveBeenCalledWith(
      'POST',
      '/boot-error',
      expect.objectContaining({ name: 'WebviewFreshness' }),
    )
  })

  it('should swallow a failing breadcrumb post', async () => {
    stampPage('aaaaaaaa')
    sessionStorage.setItem('webview_refetched_for', 'aaaaaaaa')
    const { homey } = createWidgetHomey({
      failures: { 'POST /boot-error': new Error('channel down') },
      routes: hashRoutes('bbbbbbbb'),
    })

    await expect(watchWidgetFreshness(homey, ENTRY)).resolves.toBe(false)

    await settleDetached()
  })

  it('should swallow a failing hash fetch and stay put', async () => {
    stampPage('aaaaaaaa')
    const { emit, homey } = createWidgetHomey({
      failures: { 'GET /webview-hashes': new Error('bridge down') },
    })

    await expect(watchWidgetFreshness(homey, ENTRY)).resolves.toBe(false)

    // The poke's recheck fails the same way and must not throw either.
    expect(() => {
      emit('webview_hashes_changed')
    }).not.toThrow()

    await settleDetached()
  })

  it('should re-run the handshake on the app poke', async () => {
    stampPage('aaaaaaaa')
    const { api, emit, homey } = createWidgetHomey({
      routes: hashRoutes('aaaaaaaa'),
    })
    await watchWidgetFreshness(homey, ENTRY)
    const hashCalls = (): number =>
      api.mock.calls.filter(([, path]) => path === '/webview-hashes').length
    const before = hashCalls()

    emit('webview_hashes_changed')
    await settleDetached()

    expect(hashCalls()).toBe(before + 1)
  })
})
