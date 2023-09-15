import BaseMELCloudDevice from '../../bases/device'
import type MELCloudDriverAta from './driver'
import type {
  CapabilityValue,
  DeviceValue,
  ExtendedCapability,
  ExtendedSetCapability,
  SetCapability,
  SetDeviceValue,
} from '../../types'

function isThermostatMode(value: string): boolean {
  return !['dry', 'fan'].includes(value)
}

function reverseMapping(
  mapping: Record<number | string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(mapping).map(
      ([deviceValue, capabilityValue]: [string, string]): [string, string] => [
        capabilityValue,
        deviceValue,
      ],
    ),
  )
}

const operationModeFromDevice: Record<number, string> = {
  1: 'heat',
  2: 'dry',
  3: 'cool',
  7: 'fan',
  8: 'auto',
} as const

const operationModeToDevice: Record<string, string> = reverseMapping(
  operationModeFromDevice,
)

const verticalFromDevice: Record<number, string> = {
  0: 'auto',
  1: 'top',
  2: 'middletop',
  3: 'middle',
  4: 'middlebottom',
  5: 'bottom',
  7: 'swing',
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
  12: 'swing',
} as const

const horizontalToDevice: Record<string, string> =
  reverseMapping(horizontalFromDevice)

export = class MELCloudDeviceAta extends BaseMELCloudDevice {
  declare driver: MELCloudDriverAta

  declare diff: Map<SetCapability<MELCloudDriverAta>, CapabilityValue>

  async onInit(): Promise<void> {
    this.reportPlanParameters = {
      minus: { hours: 1 },
      interval: { hours: 1 },
      duration: { hours: 1 },
      values: { minute: 5, second: 0, millisecond: 0 },
    }
    await super.onInit()
  }

  async specificOnCapability(
    capability: ExtendedSetCapability<MELCloudDriverAta>,
    value: CapabilityValue,
  ): Promise<void> {
    if (capability === 'thermostat_mode') {
      this.diff.set('onoff', value !== 'off')
      if (value !== 'off') {
        this.diff.set('operation_mode', value)
      }
      await this.setAlwaysOnWarning()
    } else {
      this.diff.set(capability, value)
      if (
        capability === 'operation_mode' &&
        !isThermostatMode(value as string) &&
        this.getCapabilityValue('thermostat_mode') !== 'off'
      ) {
        await this.setDisplayErrorWarning()
      }
    }
  }

  convertToDevice(
    capability: SetCapability<MELCloudDriverAta>,
    value: CapabilityValue = this.getCapabilityValue(
      capability,
    ) as CapabilityValue,
  ): SetDeviceValue {
    switch (capability) {
      case 'onoff':
        return this.getSetting('always_on') ? true : (value as boolean)
      case 'operation_mode':
        return Number(operationModeToDevice[value as string])
      case 'vertical':
        return Number(verticalToDevice[value as string])
      case 'horizontal':
        return Number(horizontalToDevice[value as string])
      default:
        return value as SetDeviceValue
    }
  }

  // eslint-disable-next-line class-methods-use-this
  convertFromDevice(
    capability: ExtendedCapability<MELCloudDriverAta>,
    value: DeviceValue,
  ): CapabilityValue {
    switch (capability) {
      case 'operation_mode':
        return operationModeFromDevice[value as number]
      case 'vertical':
        return verticalFromDevice[value as number]
      case 'horizontal':
        return horizontalFromDevice[value as number]
      default:
        return value
    }
  }

  async updateThermostatMode(): Promise<void> {
    const isOn: boolean = this.getCapabilityValue('onoff') as boolean
    const operationMode: string = this.getCapabilityValue(
      'operation_mode',
    ) as string
    await this.setCapabilityValue(
      'thermostat_mode',
      isOn && isThermostatMode(operationMode) ? operationMode : 'off',
    )
  }
}
