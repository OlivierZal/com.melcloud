import * as Classic from '@olivierzal/melcloud-api/classic'

const assertDeviceType: (
  value: number,
) => asserts value is Classic.DeviceType = (value) => {
  if (!(Object.values(Classic.DeviceType) as number[]).includes(value)) {
    throw new RangeError(`Invalid Classic.DeviceType: ${String(value)}`)
  }
}

export const toDeviceType = (value: string): Classic.DeviceType => {
  const deviceType = Number(value)
  assertDeviceType(deviceType)
  return deviceType
}
