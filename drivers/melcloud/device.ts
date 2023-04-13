import MELCloudDeviceMixin from '../../mixins/device_mixin'
import type MELCloudDriverAta from './driver'
import {
  getCapabilityMappingAta,
  listCapabilityMappingAta,
  reportCapabilityMappingAta,
  setCapabilityMappingAta,
  type Capability,
  type CapabilityValue,
  type ExtendedSetCapability,
  type SetCapabilities,
  type SetCapability,
  type ThermostatMode
} from '../../types'

function reverseMapping(
  mapping: Record<number | string, string>
): Record<string, string> {
  return Object.entries(mapping).reduce<Record<string, string>>(
    (reversedMapping, [deviceValue, capabilityValue]: [string, string]) => {
      reversedMapping[capabilityValue] = deviceValue
      return reversedMapping
    },
    {}
  )
}

const operationModeFromDevice: Record<number, string> = {
  1: 'heat',
  2: 'dry',
  3: 'cool',
  7: 'fan',
  8: 'auto'
} as const

const operationModeToDevice: Record<string, string> = reverseMapping(
  operationModeFromDevice
)

const verticalFromDevice: Record<number, string> = {
  0: 'auto',
  1: 'top',
  2: 'middletop',
  3: 'middle',
  4: 'middlebottom',
  5: 'bottom',
  7: 'swing'
} as const

const verticalToDevice: Record<string, string> =
  reverseMapping(verticalFromDevice)

const horizontalFromDevice: Record<number, string> = {
  0: 'auto',
  1: 'left',
  2: 'middleleft',
  3: 'middle',
  4: 'middleright',
  5: 'right',
  8: 'split',
  12: 'swing'
} as const

const horizontalToDevice: Record<string, string> =
  reverseMapping(horizontalFromDevice)

export default class MELCloudDeviceAta extends MELCloudDeviceMixin {
  declare driver: MELCloudDriverAta
  declare operationModeCapability: SetCapability<MELCloudDeviceAta>
  declare diff: SetCapabilities<MELCloudDeviceAta>

  async onInit(): Promise<void> {
    this.operationModeCapability = 'operation_mode'
    this.operationModeToThermostatMode = {
      auto: 'auto',
      heat: 'heat',
      cool: 'cool',
      dry: 'off',
      fan: 'off'
    } as const
    this.requiredCapabilities = [
      ...Object.keys({
        ...setCapabilityMappingAta,
        ...getCapabilityMappingAta,
        ...listCapabilityMappingAta
      }),
      'thermostat_mode'
    ]
    this.setCapabilityMapping = setCapabilityMappingAta
    this.getCapabilityMapping = getCapabilityMappingAta
    this.listCapabilityMapping = listCapabilityMappingAta
    this.reportCapabilityMapping = reportCapabilityMappingAta
    this.reportPlanParameters = {
      minus: { hours: 1 },
      interval: { hours: 1 },
      duration: { hours: 1 },
      values: { minute: 10, second: 0, millisecond: 0 }
    }
    await super.onInit()
  }

  async specificOnCapability(
    capability: ExtendedSetCapability<MELCloudDeviceAta>,
    value: CapabilityValue
  ): Promise<void> {
    switch (capability) {
      case 'thermostat_mode':
        if (value !== 'off') {
          this.diff.operation_mode = reverseMapping(
            this.operationModeToThermostatMode
          )[value as ThermostatMode]
        }
        break
      case 'fan_power':
        this.diff[capability] = value as number
        break
      case 'operation_mode':
      case 'vertical':
      case 'horizontal':
        this.diff[capability] = value as string
        if (
          capability === 'operation_mode' &&
          ['dry', 'fan'].includes(value as string) &&
          this.getCapabilityValue('thermostat_mode') !== 'off'
        ) {
          await this.setDisplayErrorWarning()
        }
    }
  }

  convertToDevice(
    capability: SetCapability<MELCloudDeviceAta>,
    value: CapabilityValue = this.getCapabilityValue(capability)
  ): boolean | number {
    switch (capability) {
      case 'operation_mode':
        return Number(operationModeToDevice[value as string])
      case 'vertical':
        return Number(verticalToDevice[value as string])
      case 'horizontal':
        return Number(horizontalToDevice[value as string])
      default:
        return super.convertToDevice(capability, value)
    }
  }

  async convertFromDevice(
    capability: Capability<MELCloudDeviceAta>,
    value: boolean | number
  ): Promise<void> {
    let newValue: CapabilityValue = value
    switch (capability) {
      case 'operation_mode':
        newValue = operationModeFromDevice[newValue as number]
        break
      case 'vertical':
        newValue = verticalFromDevice[newValue as number]
        break
      case 'horizontal':
        newValue = horizontalFromDevice[newValue as number]
    }
    await this.setCapabilityValue(capability, newValue)
  }
}

module.exports = MELCloudDeviceAta
