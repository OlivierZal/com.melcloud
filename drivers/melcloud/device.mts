import {
  type DeviceType,
  type ListDeviceData,
  type ListDeviceDataAta,
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
} from '@olivierzal/melcloud-api'

import {
  type SmartFanConfig,
  type SmartFanMode,
  type SmartFanState,
  calculateOptimalFanSpeed,
  createSmartFanState,
  DEFAULT_SMART_FAN_CONFIG,
  getRemainingPauseMinutes,
  isManualOverrideActive,
  setManualOverride,
  updateSmartFanState,
} from '../../lib/index.mts'
import {
  type ConvertFromDevice,
  type ConvertToDevice,
  type OpCapabilities,
  type SetCapabilities,
  type Settings,
  ThermostatModeAta,
} from '../../types/index.mts'
import { BaseMELCloudDevice } from '../base-device.mts'

import {
  EnergyReportRegularAta,
  EnergyReportTotalAta,
} from './reports/index.mts'

const EXTERNAL_TEMP_CAPABILITY = 'external_temperature'
const MS_PER_SECOND = 1000
const NO_PAUSE_MINUTES = 0
// Grace period to wait for API to sync after smart fan changes speed
const OVERRIDE_DETECTION_GRACE_SECONDS = 180

interface FanSpeedEvaluationContext {
  readonly currentRoomTemporary: number
  readonly operationMode: OperationMode
  readonly targetTemporary: number
}

export default class MELCloudDeviceAta extends BaseMELCloudDevice<DeviceType.Ata> {
  protected readonly EnergyReportRegular = EnergyReportRegularAta

  protected readonly EnergyReportTotal = EnergyReportTotalAta

  protected readonly fromDevice: Partial<
    Record<
      keyof OpCapabilities<DeviceType.Ata>,
      ConvertFromDevice<DeviceType.Ata>
    >
  > = {
    'alarm_generic.silent': ((value: FanSpeed) =>
      value === FanSpeed.silent) as ConvertFromDevice<DeviceType.Ata>,
    fan_speed: ((value: FanSpeed) =>
      value === FanSpeed.silent ?
        FanSpeed.auto
      : value) as ConvertFromDevice<DeviceType.Ata>,
    horizontal: ((value: Horizontal) =>
      Horizontal[value]) as ConvertFromDevice<DeviceType.Ata>,
    thermostat_mode: ((
      value: OperationMode,
      data: ListDeviceData<DeviceType.Ata>,
    ) =>
      data.Power ?
        OperationMode[value]
      : ThermostatModeAta.off) as ConvertFromDevice<DeviceType.Ata>,
    vertical: ((value: Vertical) =>
      Vertical[value]) as ConvertFromDevice<DeviceType.Ata>,
  }

  protected readonly thermostatMode = ThermostatModeAta

  protected readonly toDevice: Partial<
    Record<
      keyof SetCapabilities<DeviceType.Ata>,
      ConvertToDevice<DeviceType.Ata>
    >
  > = {
    horizontal: ((value: keyof typeof Horizontal) =>
      Horizontal[value]) as ConvertToDevice<DeviceType.Ata>,
    thermostat_mode: ((value: keyof typeof OperationMode) =>
      OperationMode[value]) as ConvertToDevice<DeviceType.Ata>,
    vertical: ((value: keyof typeof Vertical) =>
      Vertical[value]) as ConvertToDevice<DeviceType.Ata>,
  }

  #capabilityListenersRegistered = false

  #externalSensorUnsubscribe: (() => void) | null = null

  #lastExternalTemperature: number | null = null

  #smartFanConfig: SmartFanConfig = { ...DEFAULT_SMART_FAN_CONFIG }

  #smartFanState: SmartFanState = createSmartFanState()

  public override onDeleted(): void {
    super.onDeleted()
    this.#cleanupSmartFan()
  }

  public override async onInit(): Promise<void> {
    await super.onInit()
    await this.#initSmartFanControl()
  }

  public override async onSettings({
    changedKeys,
    newSettings,
  }: {
    changedKeys: string[]
    newSettings: Settings
  }): Promise<void> {
    await super.onSettings({ changedKeys, newSettings })

    const smartFanKeys = new Set([
      'external_sensor_id',
      'smart_fan_enabled',
      'smart_fan_manual_pause',
      'smart_fan_mode',
    ])

    if (changedKeys.some((key) => smartFanKeys.has(key))) {
      this.#cleanupSmartFan()
      await this.#initSmartFanControl()
    }
  }

  protected override async setCapabilityValues(
    data: ListDeviceDataAta,
  ): Promise<void> {
    // Detect manual fan speed override before calling super
    this.#detectManualFanOverride(data)

    await super.setCapabilityValues(data)

    /*
     * If external sensor is enabled and we have a stored temperature,
     * restore it after the sync to prevent internal sensor from overwriting
     */
    if (
      this.#smartFanConfig.externalSensorId !== null &&
      this.#lastExternalTemperature !== null
    ) {
      await this.setCapabilityValue(
        'measure_temperature',
        this.#lastExternalTemperature,
      ).catch((error: unknown) => {
        this.error('Failed to restore external temperature:', error)
      })
    }
  }

  // eslint-disable-next-line max-statements
  async #applyFanSpeedResult(
    result: {
      readonly action: 'change_fan_speed' | 'turn_off'
      readonly fanSpeed?: FanSpeed
    },
    context: FanSpeedEvaluationContext,
  ): Promise<void> {
    const { currentRoomTemporary, operationMode, targetTemporary } = context
    const logContext = `(room: ${String(currentRoomTemporary)}°C, target: ${String(targetTemporary)}°C, mode: ${OperationMode[operationMode]})`

    try {
      const device = await this.fetchDevice()
      if (device === null) {
        return
      }

      if (result.action === 'turn_off') {
        this.log(`Smart fan: Turning off due to overshoot ${logContext}`)
        // eslint-disable-next-line @typescript-eslint/naming-convention
        await device.setValues({ Power: false })
        this.#smartFanState.lastChangeTime = Date.now()
        return
      }

      const { fanSpeed } = result
      if (fanSpeed === undefined) {
        return
      }

      this.log(
        `Smart fan: Changing fan speed to ${FanSpeed[fanSpeed]} ${logContext}`,
      )
      /* eslint-disable @typescript-eslint/naming-convention */
      await device.setValues({
        SetFanSpeed: fanSpeed as Exclude<FanSpeed, FanSpeed.silent>,
      })
      /* eslint-enable @typescript-eslint/naming-convention */
      updateSmartFanState(this.#smartFanState, fanSpeed)
    } catch (error: unknown) {
      // Ignore "No data to set" error - this happens when device data isn't ready yet
      if (!(error instanceof Error) || error.message !== 'No data to set') {
        this.error('Failed to set fan speed:', error)
      }
    }
  }

  #cleanupSmartFan(): void {
    if (this.#externalSensorUnsubscribe) {
      this.#externalSensorUnsubscribe()
      this.#externalSensorUnsubscribe = null
    }
    this.#lastExternalTemperature = null
    this.#smartFanState = createSmartFanState()
  }

  // eslint-disable-next-line max-statements
  #detectManualFanOverride(data: ListDeviceDataAta): void {
    const { lastChangeTime, lastFanSpeed } = this.#smartFanState

    const { enabled: isEnabled, manualPauseMinutes } = this.#smartFanConfig

    // Only check if smart fan is enabled and we've set a fan speed before
    if (!isEnabled || lastFanSpeed === null) {
      return
    }

    // Skip if already paused due to manual override
    if (isManualOverrideActive(this.#smartFanState)) {
      return
    }

    // Skip if we recently changed the speed (waiting for API to sync our change)
    const timeSinceLastChange = Date.now() - lastChangeTime
    const gracePeriodMs = OVERRIDE_DETECTION_GRACE_SECONDS * MS_PER_SECOND
    if (timeSinceLastChange < gracePeriodMs) {
      return
    }

    // eslint-disable-next-line @typescript-eslint/prefer-destructuring
    const apiFanSpeed: FanSpeed = data.FanSpeed

    /*
     * If the fan speed from API is different from what smart fan last set,
     * it means the user manually changed it
     */
    if (apiFanSpeed !== lastFanSpeed && manualPauseMinutes > NO_PAUSE_MINUTES) {
      // eslint-disable-next-line @typescript-eslint/prefer-destructuring
      const apiFanSpeedName: string = FanSpeed[apiFanSpeed]
      this.log(
        `Smart fan: Manual override detected (was ${FanSpeed[lastFanSpeed]}, now ${apiFanSpeedName}). Pausing for ${String(manualPauseMinutes)} minutes.`,
      )
      setManualOverride(this.#smartFanState, manualPauseMinutes)
    }
  }

  async #evaluateFanSpeed(context: FanSpeedEvaluationContext): Promise<void> {
    const { currentRoomTemporary, operationMode, targetTemporary } = context
    const result = calculateOptimalFanSpeed({
      currentRoomTemp: currentRoomTemporary,
      mode: this.#smartFanConfig.mode,
      operationMode,
      state: this.#smartFanState,
      targetTemp: targetTemporary,
    })

    if (result.action === 'none') {
      return
    }

    // After the 'none' check, action can only be 'change_fan_speed' or 'turn_off'
    await this.#applyFanSpeedResult(
      result as {
        readonly action: 'change_fan_speed' | 'turn_off'
        readonly fanSpeed?: FanSpeed
      },
      context,
    )
  }

  // eslint-disable-next-line max-statements
  async #evaluateFanSpeedForExternalSensor(
    externalTemperature: number,
  ): Promise<void> {
    // Log if paused due to manual override
    if (isManualOverrideActive(this.#smartFanState)) {
      const remaining = getRemainingPauseMinutes(this.#smartFanState)
      this.log(
        `Smart fan: Paused due to manual override (${String(remaining)} min remaining)`,
      )
      return
    }

    const device = await this.fetchDevice()
    if (device?.data === undefined) {
      this.log(
        'Smart fan: Device or data not available, skipping fan evaluation',
      )
      return
    }

    const { data } = device
    if (!data.Power) {
      return
    }

    // eslint-disable-next-line @typescript-eslint/prefer-destructuring
    const operationMode: OperationMode = data.OperationMode
    // eslint-disable-next-line @typescript-eslint/prefer-destructuring
    const targetTemporary: number = data.SetTemperature
    await this.#evaluateFanSpeed({
      currentRoomTemporary: externalTemperature,
      operationMode,
      targetTemporary,
    })
  }

  // eslint-disable-next-line max-statements
  async #evaluateFanSpeedWithMode(
    externalTemperature: number,
    newMode: string,
  ): Promise<void> {
    if (isManualOverrideActive(this.#smartFanState)) {
      const remaining = getRemainingPauseMinutes(this.#smartFanState)
      this.log(
        `Smart fan: Paused due to manual override (${String(remaining)} min remaining)`,
      )
      return
    }

    const device = await this.fetchDevice()
    if (device?.data === undefined) {
      return
    }

    if (!device.data.Power) {
      return
    }

    // Convert the mode string to OperationMode enum
    const operationMode =
      newMode === 'off' ?
        device.data.OperationMode
      : OperationMode[newMode as keyof typeof OperationMode]

    await this.#evaluateFanSpeed({
      currentRoomTemporary: externalTemperature,
      operationMode,
      targetTemporary: device.data.SetTemperature,
    })
  }

  async #evaluateFanSpeedWithTargetTemp(
    externalTemperature: number,
    newTargetTemporary: number,
  ): Promise<void> {
    if (isManualOverrideActive(this.#smartFanState)) {
      const remaining = getRemainingPauseMinutes(this.#smartFanState)
      this.log(
        `Smart fan: Paused due to manual override (${String(remaining)} min remaining)`,
      )
      return
    }

    const device = await this.fetchDevice()
    if (device?.data === undefined) {
      return
    }

    if (!device.data.Power) {
      return
    }

    await this.#evaluateFanSpeed({
      currentRoomTemporary: externalTemperature,
      operationMode: device.data.OperationMode,
      targetTemporary: newTargetTemporary,
    })
  }

  async #handleExternalTemperatureUpdate(
    externalTemperature: number,
  ): Promise<void> {
    // Store the external temperature so we can restore it after API syncs
    this.#lastExternalTemperature = externalTemperature

    await this.#updateTemperatureCapabilities(externalTemperature)

    if (this.#smartFanConfig.enabled) {
      await this.#evaluateFanSpeedForExternalSensor(externalTemperature)
    }
  }

  // eslint-disable-next-line max-statements
  async #initSmartFanControl(): Promise<void> {
    const settings = this.getSettings()
    const isEnabled = settings['smart_fan_enabled'] === true
    const externalSensorId = settings['external_sensor_id'] as
      | string
      | undefined
    const mode =
      (settings['smart_fan_mode'] as SmartFanMode | undefined) ??
      DEFAULT_SMART_FAN_CONFIG.mode
    const manualPauseMinutes =
      (settings['smart_fan_manual_pause'] as number | undefined) ??
      DEFAULT_SMART_FAN_CONFIG.manualPauseMinutes

    this.#smartFanConfig = {
      enabled: isEnabled,
      externalSensorId: externalSensorId ?? null,
      manualPauseMinutes,
      mode,
    }

    this.#smartFanState = createSmartFanState()

    // Add external temperature capability if it doesn't exist
    if (!this.hasCapability(EXTERNAL_TEMP_CAPABILITY)) {
      await this.addCapability(EXTERNAL_TEMP_CAPABILITY).catch(
        (error: unknown) => {
          this.error('Failed to add external temperature capability:', error)
        },
      )
    }

    if (!isEnabled || externalSensorId === undefined) {
      this.log('Smart fan control disabled or no sensor configured')
      return
    }

    await this.#subscribeToExternalSensor(externalSensorId, mode)
    this.#registerCapabilityListeners()
  }

  #registerCapabilityListeners(): void {
    // Only register once to avoid duplicate warnings
    if (this.#capabilityListenersRegistered) {
      return
    }
    this.#capabilityListenersRegistered = true

    // Re-evaluate when target temperature changes
    this.registerCapabilityListener(
      'target_temperature',
      async (newTargetTemporary: number): Promise<void> => {
        if (
          this.#smartFanConfig.enabled &&
          this.#lastExternalTemperature !== null
        ) {
          this.log(
            `Smart fan: Target temperature changed to ${String(newTargetTemporary)}°C, re-evaluating fan speed`,
          )
          await this.#evaluateFanSpeedWithTargetTemp(
            this.#lastExternalTemperature,
            newTargetTemporary,
          )
        }
      },
    )

    // Re-evaluate when operation mode changes
    this.registerCapabilityListener(
      'thermostat_mode',
      async (newMode: string): Promise<void> => {
        if (
          this.#smartFanConfig.enabled &&
          this.#lastExternalTemperature !== null
        ) {
          this.log(
            `Smart fan: Operation mode changed to ${newMode}, re-evaluating fan speed`,
          )
          await this.#evaluateFanSpeedWithMode(
            this.#lastExternalTemperature,
            newMode,
          )
        }
      },
    )
  }

  async #subscribeToExternalSensor(
    externalSensorId: string,
    mode: SmartFanMode,
  ): Promise<void> {
    this.log(
      `Initializing smart fan control with sensor: ${externalSensorId}, mode: ${mode}`,
    )

    const didSubscribe = await this.homey.app.subscribeToTemperatureSensor(
      externalSensorId,
      (temperature: number): void => {
        this.#handleExternalTemperatureUpdate(temperature).catch(
          (error: unknown) => {
            this.error('Failed to handle temperature update:', error)
          },
        )
      },
    )

    if (didSubscribe) {
      this.#externalSensorUnsubscribe = (): void => {
        this.homey.app.unsubscribeFromTemperatureSensor(externalSensorId)
      }
      this.log('Successfully subscribed to temperature sensor')
    } else {
      this.error('Failed to subscribe to temperature sensor')
    }
  }

  async #updateTemperatureCapabilities(
    externalTemperature: number,
  ): Promise<void> {
    // Update the external temperature capability for insights
    if (this.hasCapability(EXTERNAL_TEMP_CAPABILITY)) {
      await (
        this as unknown as {
          setCapabilityValue: (cap: string, value: number) => Promise<void>
        }
      )
        .setCapabilityValue(EXTERNAL_TEMP_CAPABILITY, externalTemperature)
        .catch((error: unknown) => {
          this.error('Failed to set external temperature capability:', error)
        })
    }

    // Update the main temperature display to show external sensor
    await this.setCapabilityValue(
      'measure_temperature',
      externalTemperature,
    ).catch((error: unknown) => {
      this.error('Failed to set temperature capability:', error)
    })
  }
}
