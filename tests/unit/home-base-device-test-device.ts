import { HomeBaseMELCloudDevice } from '../../drivers/home-base-device.mts'
import {
  type HomeConvertFromDevice,
  type HomeConvertToDevice,
  type HomeSetCapabilitiesAta,
  homeSetCapabilityTagMappingAta,
} from '../../types/index.mts'

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

  public get exposedFacade(): typeof this.deviceFacade {
    return this.deviceFacade
  }

  protected override getFacade(): ReturnType<
    typeof this.homey.app.getHomeFacade
  > {
    return this.homey.app.getHomeFacade(this.id)
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected override getSetCapabilityTagMapping(): Record<string, string> {
    return homeSetCapabilityTagMappingAta
  }
}

export const createTestHomeDevice = (): TestHomeDevice =>
  new (TestHomeDevice as unknown as new () => TestHomeDevice)()
