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

const EXTERNAL_SENSOR_ALARM_CAPABILITY = 'alarm_generic.external_sensor'
const EXTERNAL_TEMP_CAPABILITY = 'external_temperature'
const MS_PER_MINUTE = 60_000
const MS_PER_SECOND = 1000
const NO_PAUSE_MINUTES = 0
// Grace period to wait for API to sync after smart fan changes speed
const OVERRIDE_DETECTION_GRACE_SECONDS = 60

interface FanSpeedEvaluationContext {
  readonly currentRoomTemporary: number
  readonly operationMode: OperationMode
  readonly targetTemporary: number
  readonly shouldSkipHysteresis?: boolean
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

  #externalSensorUnsubscribe: (() => void) | null = null

  #isExternalSensorActive = false

  #lastExternalSensorUpdate: number | null = null

  #lastExternalTemperature: number | null = null

  #lastOperationMode: OperationMode | null = null

  #lastTargetTemperature: number | null = null

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
      'smart_fan_sensor_timeout',
    ])

    if (changedKeys.some((key) => smartFanKeys.has(key))) {
      this.#cleanupSmartFan()
      await this.#initSmartFanControl()
    }
  }

  // eslint-disable-next-line max-statements
  protected override async setCapabilityValues(
    data: ListDeviceDataAta,
  ): Promise<void> {
    // Detect manual fan speed override before calling super
    this.#detectManualFanOverride(data)

    // Check if target temperature or mode changed (for smart fan re-evaluation)
    const didTargetChange = this.#lastTargetTemperature !== data.SetTemperature
    const didModeChange = this.#lastOperationMode !== data.OperationMode
    // eslint-disable-next-line @typescript-eslint/prefer-destructuring
    this.#lastTargetTemperature = data.SetTemperature
    // eslint-disable-next-line @typescript-eslint/prefer-destructuring
    this.#lastOperationMode = data.OperationMode

    await super.setCapabilityValues(data)

    // Check if external sensor is configured and handle timeout/fallback
    if (this.#smartFanConfig.externalSensorId !== null) {
      const status = await this.#getExternalSensorStatus()

      // Update sensor status if it changed
      await this.#updateExternalSensorStatus(status.isOnline, status.reason)

      if (status.isOnline && this.#lastExternalTemperature !== null) {
        // External sensor is active - use external temperature
        await this.setCapabilityValue(
          'measure_temperature',
          this.#lastExternalTemperature,
        ).catch((error: unknown) => {
          this.error('Failed to restore external temperature:', error)
        })

        // Re-evaluate fan speed if target temp or mode changed
        if ((didTargetChange || didModeChange) && data.Power) {
          this.log(
            `Smart fan: ${didTargetChange ? 'Target temperature' : 'Operation mode'} changed, re-evaluating fan speed`,
          )
          // User-initiated change - respond immediately without hysteresis delay
          await this.#evaluateFanSpeed({
            currentRoomTemporary: this.#lastExternalTemperature,
            operationMode: data.OperationMode,
            shouldSkipHysteresis: true,
            targetTemporary: data.SetTemperature,
          })
        }
      }
      // If timed out, we don't restore external temp - the internal sensor value from API stays
    }
  }

  // eslint-disable-next-line max-statements, max-lines-per-function
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

      /*
       * Update state BEFORE API call to prevent false positive manual override detection
       * (API call triggers sync which runs detectManualFanOverride)
       */
      updateSmartFanState(this.#smartFanState, fanSpeed)

      /* eslint-disable @typescript-eslint/naming-convention */
      await device.setValues({
        SetFanSpeed: fanSpeed as Exclude<FanSpeed, FanSpeed.silent>,
      })
      /* eslint-enable @typescript-eslint/naming-convention */
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
    this.#lastExternalSensorUpdate = null
    this.#isExternalSensorActive = false
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
    const {
      currentRoomTemporary,
      operationMode,
      shouldSkipHysteresis,
      targetTemporary,
    } = context
    const result = calculateOptimalFanSpeed({
      currentRoomTemp: currentRoomTemporary,
      mode: this.#smartFanConfig.mode,
      operationMode,
      shouldSkipHysteresis,
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

  async #handleExternalTemperatureUpdate(
    externalTemperature: number,
  ): Promise<void> {
    // Store the external temperature and update timestamp
    this.#lastExternalTemperature = externalTemperature
    this.#lastExternalSensorUpdate = Date.now()

    // Mark sensor as active (it just sent data)
    await this.#updateExternalSensorStatus(true, 'recent_update')

    await this.#updateTemperatureCapabilities(externalTemperature)

    if (this.#smartFanConfig.enabled) {
      await this.#evaluateFanSpeedForExternalSensor(externalTemperature)
    }
  }

  async #initSmartFanCapabilities(): Promise<void> {
    // Add external temperature capability if it doesn't exist
    if (!this.hasCapability(EXTERNAL_TEMP_CAPABILITY)) {
      await this.addCapability(EXTERNAL_TEMP_CAPABILITY).catch(
        (error: unknown) => {
          this.error('Failed to add external temperature capability:', error)
        },
      )
    }

    // Add external sensor alarm capability if it doesn't exist
    if (!this.hasCapability(EXTERNAL_SENSOR_ALARM_CAPABILITY)) {
      await this.addCapability(EXTERNAL_SENSOR_ALARM_CAPABILITY).catch(
        (error: unknown) => {
          this.error('Failed to add external sensor alarm capability:', error)
        },
      )
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
    const sensorTimeoutMinutes =
      (settings['smart_fan_sensor_timeout'] as number | undefined) ??
      DEFAULT_SMART_FAN_CONFIG.sensorTimeoutMinutes

    this.#smartFanConfig = {
      enabled: isEnabled,
      externalSensorId: externalSensorId ?? null,
      manualPauseMinutes,
      mode,
      sensorTimeoutMinutes,
    }

    this.#smartFanState = createSmartFanState()

    await this.#initSmartFanCapabilities()

    if (!isEnabled || externalSensorId === undefined) {
      this.log('Smart fan control disabled or no sensor configured')
      return
    }

    await this.#subscribeToExternalSensor(externalSensorId, mode)
  }

  /*
   * Note: We intentionally do NOT use registerCapabilityListener for
   * target_temperature or thermostat_mode because it conflicts with
   * registerMultipleCapabilityListener in the base class, which would
   * prevent temperature changes from being sent to the MELCloud API.
   *
   * Instead, smart fan re-evaluates when:
   * 1. External temperature changes (via sensor subscription)
   * 2. API sync returns new data (in setCapabilityValues)
   */

  // eslint-disable-next-line max-statements
  async #getExternalSensorStatus(): Promise<{
    readonly isOnline: boolean
    readonly reason:
      | 'available'
      | 'recent_update'
      | 'timeout'
      | 'unavailable'
      | 'unknown'
  }> {
    const { externalSensorId, sensorTimeoutMinutes } = this.#smartFanConfig

    if (externalSensorId === null) {
      return { isOnline: false, reason: 'unknown' }
    }

    // Check 1: Homey's availability status (primary source)
    const isHomeyAvailable =
      await this.homey.app.getExternalSensorAvailability(externalSensorId)

    if (isHomeyAvailable === false) {
      return { isOnline: false, reason: 'unavailable' }
    }

    if (isHomeyAvailable === true) {
      return { isOnline: true, reason: 'available' }
    }

    // Check 2: Fallback to timeout logic (isHomeyAvailable is null/unknown)
    if (this.#lastExternalSensorUpdate !== null) {
      const timeoutMs = sensorTimeoutMinutes * MS_PER_MINUTE
      const timeSinceLastUpdate = Date.now() - this.#lastExternalSensorUpdate

      if (timeSinceLastUpdate <= timeoutMs) {
        return { isOnline: true, reason: 'recent_update' }
      }

      // Timeout expired - but keep using cached temperature if available
      if (this.#lastExternalTemperature !== null) {
        this.log(
          `External sensor: Timeout expired but using cached temperature (${String(this.#lastExternalTemperature)}°C)`,
        )
        return { isOnline: true, reason: 'recent_update' }
      }

      return { isOnline: false, reason: 'timeout' }
    }

    return { isOnline: false, reason: 'unknown' }
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

  async #updateExternalSensorStatus(
    isActive: boolean,
    reason?:
      | 'available'
      | 'recent_update'
      | 'timeout'
      | 'unavailable'
      | 'unknown',
  ): Promise<void> {
    // Only update and log if status actually changed
    if (this.#isExternalSensorActive === isActive) {
      return
    }

    this.#isExternalSensorActive = isActive

    if (isActive) {
      const reasonText =
        reason === 'available' ?
          '(Homey reports device available)'
        : '(recent temperature update received)'
      this.log(`External temperature sensor is now active ${reasonText}`)
    } else {
      const reasonText =
        reason === 'unavailable' ? 'Homey reports device unavailable'
        : reason === 'timeout' ?
          `no update for ${String(this.#smartFanConfig.sensorTimeoutMinutes)} minutes and no valid cached temperature`
        : 'unknown reason'
      this.log(`External temperature sensor offline - ${reasonText}`)
    }

    // Update the alarm capability (triggers flow automatically)
    if (this.hasCapability(EXTERNAL_SENSOR_ALARM_CAPABILITY)) {
      await (
        this as unknown as {
          setCapabilityValue: (cap: string, value: boolean) => Promise<void>
        }
      )
        .setCapabilityValue(EXTERNAL_SENSOR_ALARM_CAPABILITY, isActive)
        .catch((error: unknown) => {
          this.error('Failed to set external sensor alarm capability:', error)
        })
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
