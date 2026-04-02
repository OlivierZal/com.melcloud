import type {
  HomeConvertFromDevice,
  HomeConvertToDevice,
  HomeSetCapabilitiesAta,
} from '../../types/index.mts'
import { HomeBaseMELCloudDevice } from '../../drivers/home-base-device.mts'

export class TestHomeDevice extends HomeBaseMELCloudDevice {
  public capabilityToDevice: Partial<
    Record<keyof HomeSetCapabilitiesAta, HomeConvertToDevice>
  > = {}

  public readonly deviceToCapability: Partial<
    Record<string, HomeConvertFromDevice>
  > = {
    measure_temperature: ({ roomTemperature }) => roomTemperature,
    onoff: ({ power }) => power,
    target_temperature: ({ setTemperature }) => setTemperature,
    thermostat_mode: ({ operationMode, power }) =>
      power ? operationMode : 'off',
  }

  public readonly thermostatMode: Record<string, string> | null = null

  public get exposedFacade(): typeof this.facade {
    return this.facade
  }
}

export const createTestHomeDevice = (): TestHomeDevice =>
  new (TestHomeDevice as unknown as new () => TestHomeDevice)()
