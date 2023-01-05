import { DateTime } from 'luxon'
import Homey from 'homey/lib/Homey'
import MELCloudApp from './app'
import { Error, ErrorData, ErrorLog, ErrorLogData, LoginCredentials, MELCloudDevice, Settings } from './types'

module.exports = {
  async login ({ homey, body }: { homey: Homey, body: LoginCredentials }): Promise<boolean> {
    return await (homey.app as MELCloudApp).login(body)
  },
  async setSettings ({ homey, body }: { homey: Homey, body: Settings }): Promise<void> {
    await (homey.app as MELCloudApp).setSettings(body)
  },
  async getUnitErrorLog ({ homey }: { homey: Homey }): Promise<ErrorLog | null> {
    const app: MELCloudApp = homey.app as MELCloudApp
    const data: ErrorLogData | null = await app.getUnitErrorLog()
    if (data === null) {
      return null
    }
    return data.map((errorData: ErrorData): Error => (
      {
        Device: app.getDevices().filter((device: MELCloudDevice): boolean => device.id === errorData.DeviceId)[0].getName(),
        'Start Date': errorData.StartDate !== null && DateTime.fromISO(errorData.StartDate).year !== 1
          ? DateTime.fromISO(errorData.StartDate).setZone('utc').toLocal().toLocaleString(DateTime.DATETIME_FULL_WITH_SECONDS)
          : '',
        Error: errorData.ErrorMessage ?? ''
      }
    )).filter((error: Error): boolean => error['Start Date'] !== '' && error.Error !== '')
  }
}
