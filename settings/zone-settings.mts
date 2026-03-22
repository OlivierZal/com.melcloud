import type {
  FrostProtectionData,
  FrostProtectionQuery,
  HolidayModeData,
  HolidayModeQuery,
  ZoneSettings,
} from '@olivierzal/melcloud-api'
import type Homey from 'homey/lib/HomeySettings'

import type { Zone } from '../types/index.mts'

import type { DeviceSettingsManager } from './device-settings.mts'

import {
  FROST_PROTECTION_TEMPERATURE_GAP,
  initFrostProtectionMaxElement,
  initFrostProtectionMinElement,
  int,
} from './dom-helpers.mts'
import {
  createOptionElement,
  getButtonElement,
  getInputElement,
  getSelectElement,
} from './dom.mts'
import { getErrorMessage, homeyApiGet, homeyApiPut } from './homey-api.mts'
import { getZoneId, getZoneName } from './zones.mts'

const getSubzones = (zone: Zone): Zone[] => [
  ...('devices' in zone ? zone.devices : []),
  ...('areas' in zone ? zone.areas : []),
  ...('floors' in zone ? zone.floors : []),
]

export class ZoneSettingsManager {
  readonly #deviceSettingsManager: DeviceSettingsManager

  readonly #frostProtectionEnabledElement: HTMLSelectElement

  readonly #frostProtectionMaxTemperatureElement: HTMLInputElement

  readonly #frostProtectionMinTemperatureElement: HTMLInputElement

  readonly #holidayModeEnabledElement: HTMLSelectElement

  readonly #holidayModeEndDateElement: HTMLInputElement

  readonly #holidayModeStartDateElement: HTMLInputElement

  readonly #homey: Homey

  readonly #zoneElement: HTMLSelectElement

  #zoneMapping: Partial<Record<string, Partial<ZoneSettings>>> = {}

  public constructor(
    homey: Homey,
    deviceSettingsManager: DeviceSettingsManager,
  ) {
    this.#homey = homey
    this.#deviceSettingsManager = deviceSettingsManager
    this.#zoneElement = getSelectElement('zones')
    this.#frostProtectionEnabledElement = getSelectElement(
      'enabled_frost_protection',
    )
    this.#holidayModeEnabledElement = getSelectElement('enabled_holiday_mode')
    this.#frostProtectionMinTemperatureElement = initFrostProtectionMinElement()
    this.#frostProtectionMaxTemperatureElement = initFrostProtectionMaxElement()
    this.#holidayModeStartDateElement = getInputElement('start_date')
    this.#holidayModeEndDateElement = getInputElement('end_date')
  }

  public addEventListeners(): void {
    this.#zoneElement.addEventListener('change', () => {
      this.fetchZoneSettings().catch(() => {
        // Errors are handled internally by fetchFrostProtectionData and fetchHolidayModeData
      })
    })
    this.#addHolidayModeEventListeners()
    this.#addFrostProtectionEventListeners()
  }

  public async fetchFrostProtectionData(): Promise<void> {
    await this.#deviceSettingsManager.withDisablingButtons(
      'frost_protection',
      async () => {
        try {
          const data = await homeyApiGet<FrostProtectionData>(
            this.#homey,
            `/settings/frost_protection/${this.#getZonePath()}`,
          )
          this.#updateZoneMapping(data)
          this.refreshFrostProtectionData()
        } catch {
          // Non-critical: UI falls back to default values
        }
      },
    )
  }

  public async fetchHolidayModeData(): Promise<void> {
    await this.#deviceSettingsManager.withDisablingButtons(
      'holiday_mode',
      async () => {
        try {
          const data = await homeyApiGet<HolidayModeData>(
            this.#homey,
            `/settings/holiday_mode/${this.#getZonePath()}`,
          )
          this.#updateZoneMapping(data)
          this.refreshHolidayModeData()
        } catch {
          // Non-critical: UI falls back to default values
        }
      },
    )
  }

  public async fetchZoneSettings(): Promise<void> {
    await this.fetchFrostProtectionData()
    await this.fetchHolidayModeData()
  }

  public async generateZones(zones: Zone[] = []): Promise<void> {
    if (zones.length) {
      for (const zone of zones) {
        const { id, level, model, name } = zone
        createOptionElement(this.#zoneElement, {
          id: getZoneId(id, model),
          label: getZoneName(name, level),
        })
        // eslint-disable-next-line no-await-in-loop
        await this.generateZones(getSubzones(zone))
      }
    }
  }

  public refreshFrostProtectionData(): void {
    const { [this.#zoneElement.value]: data } = this.#zoneMapping
    if (data) {
      const {
        FPEnabled: isEnabled,
        FPMaxTemperature: max,
        FPMinTemperature: min,
      } = data
      this.#frostProtectionEnabledElement.value = String(isEnabled)
      this.#frostProtectionMinTemperatureElement.value = String(min)
      this.#frostProtectionMaxTemperatureElement.value = String(max)
    }
  }

  public refreshHolidayModeData(): void {
    const { [this.#zoneElement.value]: data } = this.#zoneMapping
    if (data) {
      const {
        HMEnabled: isEnabled = false,
        HMEndDate: endDate,
        HMStartDate: startDate,
      } = data
      this.#holidayModeEnabledElement.value = String(isEnabled)
      this.#holidayModeStartDateElement.value =
        isEnabled ? (startDate ?? '') : ''
      this.#holidayModeEndDateElement.value = isEnabled ? (endDate ?? '') : ''
    }
  }

  public async setFrostProtectionData({
    enabled,
    max,
    min,
  }: FrostProtectionQuery): Promise<void> {
    await this.#deviceSettingsManager.withDisablingButtons(
      'frost_protection',
      async () => {
        try {
          await homeyApiPut<unknown>(
            this.#homey,
            `/settings/frost_protection/${this.#getZonePath()}`,
            { enabled, max, min } satisfies FrostProtectionQuery,
          )
          this.#updateZoneMapping({
            FPEnabled: enabled,
            FPMaxTemperature: max,
            FPMinTemperature: min,
          })
          this.refreshFrostProtectionData()
          await this.#homey.alert(this.#homey.__('settings.success'))
        } catch (error) {
          await this.#homey.alert(getErrorMessage(error))
        }
      },
    )
  }

  public async setHolidayModeData({
    from: startDate,
    to: endDate,
  }: HolidayModeQuery): Promise<void> {
    await this.#deviceSettingsManager.withDisablingButtons(
      'holiday_mode',
      async () => {
        try {
          await homeyApiPut<unknown>(
            this.#homey,
            `/settings/holiday_mode/${this.#zoneElement.value.replace('_', '/')}`,
            { from: startDate, to: endDate } satisfies HolidayModeQuery,
          )
          this.#updateZoneMapping({
            HMEnabled: Boolean(endDate),
            HMEndDate: endDate,
            HMStartDate: startDate,
          })
          this.refreshHolidayModeData()
          await this.#homey.alert(this.#homey.__('settings.success'))
        } catch (error) {
          await this.#homey.alert(getErrorMessage(error))
        }
      },
    )
  }

  #addDateChangeListener(
    primaryElement: HTMLInputElement,
    otherElement: HTMLInputElement,
  ): void {
    primaryElement.addEventListener('change', () => {
      if (primaryElement.value) {
        if (this.#holidayModeEnabledElement.value === 'false') {
          this.#holidayModeEnabledElement.value = 'true'
        }
      } else if (
        !otherElement.value &&
        this.#holidayModeEnabledElement.value === 'true'
      ) {
        this.#holidayModeEnabledElement.value = 'false'
      }
    })
  }

  #addFrostProtectionEventListeners(): void {
    for (const element of [
      this.#frostProtectionMinTemperatureElement,
      this.#frostProtectionMaxTemperatureElement,
    ]) {
      element.addEventListener('change', () => {
        if (element.value === 'false') {
          element.value = 'true'
        }
      })
    }
    getButtonElement('refresh_frost_protection').addEventListener(
      'click',
      () => {
        this.refreshFrostProtectionData()
      },
    )
    getButtonElement('apply_frost_protection').addEventListener('click', () => {
      try {
        const { max, min } = this.#getFPMinAndMax()
        this.setFrostProtectionData({
          enabled: this.#frostProtectionEnabledElement.value === 'true',
          max,
          min,
        }).catch(() => {
          // Errors are handled internally via homey.alert in setFrostProtectionData
        })
      } catch (error) {
        this.#homey.alert(getErrorMessage(error)).catch(() => {
          // Best-effort UI notification: the alert itself is the error display
        })
      }
    })
  }

  #addHolidayModeEventListeners(): void {
    this.#holidayModeEnabledElement.addEventListener('change', () => {
      if (this.#holidayModeEnabledElement.value === 'false') {
        this.#holidayModeStartDateElement.value = ''
        this.#holidayModeEndDateElement.value = ''
      }
    })
    this.#addDateChangeListener(
      this.#holidayModeStartDateElement,
      this.#holidayModeEndDateElement,
    )
    this.#addDateChangeListener(
      this.#holidayModeEndDateElement,
      this.#holidayModeStartDateElement,
    )
    getButtonElement('refresh_holiday_mode').addEventListener('click', () => {
      this.refreshHolidayModeData()
    })
    getButtonElement('apply_holiday_mode').addEventListener('click', () => {
      const isEnabled = this.#holidayModeEnabledElement.value === 'true'
      const endDate = this.#holidayModeEndDateElement.value || undefined
      if (isEnabled && endDate === undefined) {
        this.#homey
          .alert(this.#homey.__('settings.holidayMode.endDateMissing'))
          .catch(() => {
            // Best-effort UI notification: the alert itself is the error display
          })
        return
      }
      this.setHolidayModeData({
        from: this.#holidayModeStartDateElement.value || undefined,
        to: endDate,
      }).catch(() => {
        // Errors are handled internally via homey.alert in setHolidayModeData
      })
    })
  }

  #getFPMinAndMax(): { max: number; min: number } {
    const errors: string[] = []
    let [min = null, max = null] = [
      this.#frostProtectionMinTemperatureElement,
      this.#frostProtectionMaxTemperatureElement,
    ].map((element) => {
      try {
        return int(this.#homey, element)
      } catch (error) {
        errors.push(getErrorMessage(error))
        return null
      }
    })
    if (errors.length || min === null || max === null) {
      throw new Error(errors.join('\n') || 'Unknown error')
    }
    if (max < min) {
      ;[min, max] = [max, min]
    }
    return { max: Math.max(max, min + FROST_PROTECTION_TEMPERATURE_GAP), min }
  }

  #getZonePath(): string {
    return this.#zoneElement.value.replace('_', '/')
  }

  #updateZoneMapping(data: Partial<ZoneSettings>): void {
    const { value } = this.#zoneElement
    this.#zoneMapping[value] = { ...this.#zoneMapping[value], ...data }
  }
}
