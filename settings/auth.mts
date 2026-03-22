import type { LoginCredentials } from '@olivierzal/melcloud-api'
import type Homey from 'homey/lib/HomeySettings'

import type { DriverSetting, LoginDriverSetting } from '../types/index.mts'

import {
  createInputElement,
  createValueElement,
  hide,
  withDisablingButton,
} from './dom-helpers.mts'
import { getButtonElement, getDivElement } from './dom.mts'
import { getErrorMessage, homeyApiPost } from './homey-api.mts'

export class AuthManager {
  readonly #authenticatedElement: HTMLDivElement

  readonly #authenticateElement: HTMLButtonElement

  readonly #authenticatingElement: HTMLDivElement

  readonly #homey: Homey

  readonly #loadPostLoginCallback: () => Promise<void>

  readonly #loginElement: HTMLDivElement

  #passwordElement: HTMLInputElement | null = null

  #usernameElement: HTMLInputElement | null = null

  public constructor(homey: Homey, loadPostLoginCallback: () => Promise<void>) {
    this.#homey = homey
    this.#loadPostLoginCallback = loadPostLoginCallback
    this.#authenticateElement = getButtonElement('authenticate')
    this.#authenticatedElement = getDivElement('authenticated')
    this.#authenticatingElement = getDivElement('authenticating')
    this.#loginElement = getDivElement('login')
  }

  public addEventListeners(): void {
    this.#authenticateElement.addEventListener('click', () => {
      this.login().catch(() => {
        // Errors are handled internally via homey.alert in login
      })
    })
  }

  public generateCredentials(
    driverSettings: Partial<Record<string, DriverSetting[]>>,
    {
      password,
      username,
    }: { password?: string | null; username?: string | null },
  ): void {
    this.#usernameElement = this.#generateCredential(
      'username',
      driverSettings,
      username,
    )
    this.#passwordElement = this.#generateCredential(
      'password',
      driverSettings,
      password,
    )
  }

  public async login(): Promise<void> {
    const username = this.#usernameElement?.value ?? ''
    const password = this.#passwordElement?.value ?? ''
    if (!username || !password) {
      this.#homey
        .alert(this.#homey.__('settings.authenticate.failure'))
        .catch(() => {
          // Best-effort UI notification: the alert itself is the error display
        })
      return
    }
    await withDisablingButton(this.#authenticateElement.id, async () => {
      try {
        const isLoggedIn = await homeyApiPost<boolean>(
          this.#homey,
          '/sessions',
          { password, username } satisfies LoginCredentials,
        )
        await (isLoggedIn ?
          this.#loadPostLoginCallback()
        : this.#homey.alert(this.#homey.__('settings.authenticate.failure')))
      } catch (error) {
        await this.#homey.alert(getErrorMessage(error))
      }
    })
  }

  public needsAuthentication(value = true): void {
    hide(this.#authenticatedElement, value)
    hide(this.#authenticatingElement, !value)
  }

  #generateCredential(
    credentialKey: keyof LoginCredentials,
    driverSettings: Partial<Record<string, DriverSetting[]>>,
    value?: string | null,
  ): HTMLInputElement | null {
    const loginSetting = driverSettings['login']?.find(
      (setting): setting is LoginDriverSetting => setting.id === credentialKey,
    )
    if (loginSetting) {
      const { id, placeholder, title, type } = loginSetting
      const valueElement = createInputElement({ id, placeholder, type, value })
      createValueElement(this.#loginElement, { title, valueElement })
      return valueElement
    }
    return null
  }
}
