import type Homey from 'homey/lib/HomeySettings'

import type {
  DeviceSetting,
  DeviceSettings,
  DriverSetting,
  Settings,
  ValueOf,
} from '../types/index.mts'

import {
  commonElementTypes,
  commonElementValueTypes,
  createCheckboxElement,
  createLegendElement,
  createSelectElement,
  createValueElement,
  disableButton,
  hide,
  int,
} from './dom-helpers.mts'
import {
  type HTMLValueElement,
  booleanStrings,
  getButtonElement,
  getDivElement,
} from './dom.mts'
import { getErrorMessage, homeyApiGet, homeyApiPut } from './homey-api.mts'

const SIZE_ONE = 1

export class DeviceSettingsManager {
  readonly #homey: Homey

  readonly #settingsCommonElement: HTMLDivElement

  #deviceSettings: Partial<DeviceSettings> = {}

  #flatDeviceSettings: Partial<DeviceSetting> = {}

  public constructor(homey: Homey) {
    this.#homey = homey
    this.#settingsCommonElement = getDivElement('settings_common')
  }

  public get deviceSettings(): Partial<DeviceSettings> {
    return this.#deviceSettings
  }

  public get flatDeviceSettings(): Partial<DeviceSetting> {
    return this.#flatDeviceSettings
  }

  public disableButtons(id: string, value = true): void {
    this.#disableButtons(id, value)
  }

  public async fetchDeviceSettings(): Promise<void> {
    try {
      this.#deviceSettings = await homeyApiGet<DeviceSettings>(
        this.#homey,
        '/settings/devices',
      )
      this.#fetchFlattenDeviceSettings()
    } catch (error) {
      await this.#homey.alert(getErrorMessage(error))
    }
  }

  public async fetchDriverSettings(): Promise<
    Partial<Record<string, DriverSetting[]>>
  > {
    try {
      const settings = await homeyApiGet<
        Partial<Record<string, DriverSetting[]>>
      >(this.#homey, '/settings/drivers')
      this.#generateSettings(settings)
      return settings
    } catch (error) {
      await this.#homey.alert(getErrorMessage(error))
      return {}
    }
  }

  public async withDisablingButtons(
    id: string,
    action: () => Promise<void>,
  ): Promise<void> {
    this.#disableButtons(id)
    await action()
    this.#disableButtons(id, false)
  }

  #addApplySettingsEventListener(
    elements: HTMLValueElement[],
    driverId?: string,
  ): void {
    const settings = `settings_${driverId ?? 'common'}`
    const buttonElement = getButtonElement(`apply_${settings}`)
    buttonElement.addEventListener('click', () => {
      this.#setDeviceSettings(elements, driverId).catch(() => {
        // Errors are handled internally via homey.alert in #setDeviceSettings
      })
    })
  }

  #addRefreshSettingsEventListener(
    elements: HTMLValueElement[],
    driverId?: string,
  ): void {
    const settings = `settings_${driverId ?? 'common'}`
    const buttonElement = getButtonElement(`refresh_${settings}`)
    buttonElement.addEventListener('click', () => {
      if (driverId !== undefined) {
        this.#refreshDriverSettings(
          elements.filter((element) => element instanceof HTMLInputElement),
        )
        return
      }
      this.#refreshCommonSettings(
        elements.filter((element) => element instanceof HTMLSelectElement),
      )
    })
  }

  #addSettingsEventListeners(
    elements: HTMLValueElement[],
    driverId?: string,
  ): void {
    this.#addApplySettingsEventListener(elements, driverId)
    this.#addRefreshSettingsEventListener(elements, driverId)
  }

  #buildSettingsBody(elements: HTMLValueElement[]): Settings {
    const errors: string[] = []
    const settings: Settings = {}
    for (const element of elements) {
      try {
        this.#setSetting(settings, element)
      } catch (error) {
        errors.push(getErrorMessage(error))
      }
    }
    if (errors.length) {
      throw new Error(errors.join('\n') || 'Unknown error')
    }
    return settings
  }

  #disableButtons(id: string, value = true): void {
    const isCommon = id.endsWith('common')
    for (const action of ['apply', 'refresh']) {
      disableButton(`${action}_${id}`, value)
      if (isCommon) {
        for (const driverId of Object.keys(this.#deviceSettings)) {
          disableButton(`${action}_${id.replace(/common$/u, driverId)}`, value)
        }
      }
    }
  }

  #fetchFlattenDeviceSettings(): void {
    this.#flatDeviceSettings = Object.fromEntries(
      Object.entries(
        Object.groupBy(
          Object.values(this.#deviceSettings).flatMap((settings) =>
            Object.entries(settings ?? {}).map(([id, values]) => ({
              id,
              values,
            })),
          ),
          ({ id }) => id,
        ),
      ).map(([id, groupedValues]) => {
        const set = new Set(groupedValues?.map(({ values }) => values))
        return [id, set.size === SIZE_ONE ? set.values().next().value : null]
      }),
    )
  }

  #generateCommonSettings(
    driverSettings: Partial<Record<string, DriverSetting[]>>,
  ): void {
    for (const { id, title, type, values } of driverSettings['options'] ?? []) {
      const settingId = `${id}__settings_common`
      if (
        !this.#settingsCommonElement.querySelector(`select#${settingId}`) &&
        commonElementTypes.has(type)
      ) {
        const valueElement = createSelectElement(this.#homey, settingId, values)
        createValueElement(this.#settingsCommonElement, { title, valueElement })
        this.#updateCommonSetting(valueElement)
      }
    }
    this.#addSettingsEventListeners(
      // eslint-disable-next-line unicorn/prefer-spread
      Array.from(this.#settingsCommonElement.querySelectorAll('select')),
    )
  }

  #generateDriverSettings(
    driverSettings: Partial<Record<string, DriverSetting[]>>,
    driverId: string,
  ): void {
    const { [driverId]: driverSetting } = driverSettings
    if (driverSetting) {
      const settingsElement = document.querySelector(`#settings_${driverId}`)
      if (settingsElement) {
        const fieldSetElement = document.createElement('fieldset')
        fieldSetElement.classList.add('homey-form-checkbox-set')
        this.#handleDriverSettings(driverSetting, fieldSetElement)
        settingsElement.append(fieldSetElement)
        this.#addSettingsEventListeners(
          // eslint-disable-next-line unicorn/prefer-spread
          Array.from(fieldSetElement.querySelectorAll('input')),
          driverId,
        )
        hide(getDivElement(`has_devices_${driverId}`), false)
      }
    }
  }

  #generateSettings(
    driverSettings: Partial<Record<string, DriverSetting[]>>,
  ): void {
    this.#generateCommonSettings(driverSettings)
    for (const driverId of Object.keys(this.#deviceSettings)) {
      this.#generateDriverSettings(driverSettings, driverId)
    }
  }

  #handleDriverSettings(
    driverSetting: DriverSetting[],
    fieldSetElement: HTMLFieldSetElement,
  ): void {
    let previousGroupLabel = ''
    for (const { driverId, groupLabel, id, title, type } of driverSetting) {
      if (type === 'checkbox') {
        if (groupLabel !== previousGroupLabel) {
          previousGroupLabel = groupLabel ?? ''
          createLegendElement(fieldSetElement, groupLabel)
        }
        const valueElement = createCheckboxElement(id, driverId)
        createValueElement(fieldSetElement, { title, valueElement }, false)
        this.#updateDriverSetting(valueElement)
      }
    }
  }

  #processValue(element: HTMLValueElement): ValueOf<Settings> {
    if (element.value) {
      if (element.type === 'checkbox') {
        return element.indeterminate ? null : element.checked
      }
      if (
        element.type === 'number' &&
        element.min !== '' &&
        element.max !== ''
      ) {
        return int(this.#homey, element)
      }
      if (booleanStrings.includes(element.value)) {
        return element.value === 'true'
      }
      const numberValue = Number(element.value)
      return Number.isFinite(numberValue) ? numberValue : element.value
    }
    return null
  }

  #refreshCommonSettings(elements: HTMLSelectElement[]): void {
    for (const element of elements) {
      this.#updateCommonSetting(element)
    }
  }

  #refreshDriverSettings(elements: HTMLInputElement[]): void {
    for (const element of elements) {
      this.#updateDriverSetting(element)
    }
  }

  async #setDeviceSettings(
    elements: HTMLValueElement[],
    driverId?: string,
  ): Promise<void> {
    const body = this.#buildSettingsBody(elements)
    if (!Object.keys(body).length) {
      if (driverId === undefined) {
        this.#refreshCommonSettings(
          elements.filter((element) => element instanceof HTMLSelectElement),
        )
      }
      this.#homey
        .alert(this.#homey.__('settings.devices.apply.nothing'))
        .catch(() => {
          // Best-effort UI notification: the alert itself is the error display
        })
      return
    }
    await this.withDisablingButtons(
      `settings_${driverId ?? 'common'}`,
      async () => {
        try {
          await homeyApiPut<unknown>(
            this.#homey,
            `/settings/devices${
              driverId === undefined ? '' : (
                `?${new URLSearchParams({ driverId } satisfies {
                  driverId: string
                })}`
              )
            }`,
            body satisfies Settings,
          )
          this.#updateDeviceSettings(body, driverId)
          await this.#homey.alert(this.#homey.__('settings.success'))
        } catch (error) {
          await this.#homey.alert(getErrorMessage(error))
        }
      },
    )
  }

  #setSetting(settings: Settings, element: HTMLValueElement): void {
    const [id, driverId] = element.id.split('__settings_')
    if (id !== undefined) {
      const value = this.#processValue(element)
      if (
        this.#shouldUpdate(
          id,
          value,
          driverId === 'common' ? undefined : driverId,
        )
      ) {
        settings[id] = value
      }
    }
  }

  #shouldUpdate(
    id: string,
    value: ValueOf<Settings>,
    driverId?: string,
  ): boolean {
    if (value !== null) {
      const setting =
        driverId === undefined ?
          this.#flatDeviceSettings[id]
        : this.#deviceSettings[driverId]?.[id]
      return setting === null ? true : value !== setting
    }
    return false
  }

  #updateCommonSetting(element: HTMLSelectElement): void {
    const [id] = element.id.split('__settings_')
    if (id !== undefined) {
      const { [id]: value } = this.#flatDeviceSettings
      element.value =
        commonElementValueTypes.has(typeof value) ? String(value) : ''
    }
  }

  #updateDeviceSettings(body: Settings, driverId?: string): void {
    const drivers =
      driverId === undefined ? Object.keys(this.#deviceSettings) : [driverId]
    for (const [id, value] of Object.entries(body)) {
      for (const driver of drivers) {
        this.#deviceSettings[driver] ??= {}
        this.#deviceSettings[driver][id] = value
      }
      if (driverId === undefined) {
        this.#flatDeviceSettings[id] = value
      }
    }
    if (driverId !== undefined) {
      this.#fetchFlattenDeviceSettings()
    }
  }

  #updateDriverSetting(element: HTMLInputElement): void {
    const [id, driverId] = element.id.split('__settings_')
    if (id !== undefined && driverId !== undefined) {
      const isChecked = this.#deviceSettings[driverId]?.[id]
      if (typeof isChecked === 'boolean') {
        element.checked = isChecked
        return
      }
      element.indeterminate = true
      element.addEventListener(
        'change',
        () => {
          element.indeterminate = false
        },
        { once: true },
      )
    }
  }
}
