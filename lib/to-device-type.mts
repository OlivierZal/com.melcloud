import { DeviceType } from '@olivierzal/melcloud-api'

const assertDeviceType: (value: number) => asserts value is DeviceType = (
  value,
) => {
  if (!(Object.values(DeviceType) as number[]).includes(value)) {
    throw new RangeError(`Invalid DeviceType: ${String(value)}`)
  }
}

export const toDeviceType = (value: string): DeviceType => {
  const deviceType = Number(value)
  assertDeviceType(deviceType)
  return deviceType
}
