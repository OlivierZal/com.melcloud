import * as Classic from '@olivierzal/melcloud-api/classic'
import * as Home from '@olivierzal/melcloud-api/home'

const assertHomeDeviceType: (
  value: string,
) => asserts value is Home.DeviceType = (value) => {
  if (!(Object.values(Home.DeviceType) as string[]).includes(value)) {
    throw new RangeError(`Invalid Home.DeviceType: ${value}`)
  }
}

export const toHomeDeviceType = (value: string): Home.DeviceType => {
  assertHomeDeviceType(value)
  return value
}

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
