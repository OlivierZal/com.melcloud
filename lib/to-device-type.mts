import { ClassicDeviceType } from '@olivierzal/melcloud-api'

const assertDeviceType: (
  value: number,
) => asserts value is ClassicDeviceType = (value) => {
  if (!(Object.values(ClassicDeviceType) as number[]).includes(value)) {
    throw new RangeError(`Invalid ClassicDeviceType: ${String(value)}`)
  }
}

export const toDeviceType = (value: string): ClassicDeviceType => {
  const deviceType = Number(value)
  assertDeviceType(deviceType)
  return deviceType
}
