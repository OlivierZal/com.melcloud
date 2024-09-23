import type Homey from 'homey/lib/Homey'

import {
  type AreaFacade,
  type AreaModelAny,
  type BuildingFacade,
  type FloorFacade,
  type FloorModel,
  type FrostProtectionData,
  type GroupAtaState,
  type HolidayModeData,
  type LoginCredentials,
  BuildingModel,
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
} from '@olivierzal/melcloud-api'
import fanSpeed from 'homey-lib/assets/capability/capabilities/fan_speed.json'
import power from 'homey-lib/assets/capability/capabilities/onoff.json'
import setTemperature from 'homey-lib/assets/capability/capabilities/target_temperature.json'
import thermostatMode from 'homey-lib/assets/capability/capabilities/thermostat_mode.json'

import type MELCloudApp from '.'

import horizontal from './.homeycompose/capabilities/horizontal.json'
import vertical from './.homeycompose/capabilities/vertical.json'
import {
  type AreaZone,
  type BuildingZone,
  type DeviceSettings,
  type DriverCapabilitiesOptions,
  type DriverSetting,
  type ErrorLog,
  type ErrorLogQuery,
  type FloorZone,
  type FrostProtectionSettings,
  type HolidayModeSettings,
  type LoginSetting,
  type Manifest,
  type ManifestDriver,
  type ManifestDriverCapabilitiesOptions,
  type Settings,
  type ZoneData,
  fanSpeedValues,
  modelClass,
} from './types'

const compareNames = (
  { name: name1 }: { name: string },
  { name: name2 }: { name: string },
): number => name1.localeCompare(name2)

const mapArea = ({ id, name }: AreaModelAny): AreaZone => ({
  id,
  name,
})

const mapFloor = ({ areas, id, name }: FloorModel): FloorZone => ({
  areas: areas.sort(compareNames).map(mapArea),
  id,
  name,
})

const mapBuilding = ({
  areas,
  floors,
  id,
  name,
}: BuildingModel): BuildingZone => ({
  areas: areas
    .filter(({ floorId }: { floorId: number | null }) => floorId === null)
    .sort(compareNames)
    .map(mapArea),
  floors: floors.sort(compareNames).map(mapFloor),
  id,
  name,
})

const getFacade = (
  homey: Homey,
  zoneType: keyof typeof modelClass,
  id: number,
): AreaFacade | BuildingFacade | FloorFacade => {
  const model = modelClass[zoneType].getById(id)
  if (!model) {
    throw new Error(homey.__('errors.zoneNotFound'))
  }
  return (homey.app as MELCloudApp).facadeManager.get(model)
}

const formatErrors = (errors: Record<string, readonly string[]>): string =>
  Object.entries(errors)
    .map(([error, messages]) => `${error}: ${messages.join(', ')}`)
    .join('\n')

const handleResponse = (
  errors: Record<string, readonly string[]> | null,
): void => {
  if (errors) {
    throw new Error(formatErrors(errors))
  }
}

const getDriverSettings = (
  { id: driverId, settings }: ManifestDriver,
  language: string,
): DriverSetting[] =>
  (settings ?? []).flatMap(({ children, id: groupId, label: groupLabel }) =>
    (children ?? []).map(({ id, label, max, min, type, units, values }) => ({
      driverId,
      groupId,
      groupLabel: groupLabel[language] ?? groupLabel.en,
      id,
      max,
      min,
      title: label[language] ?? label.en,
      type,
      units,
      values: values?.map(({ id: valueId, label: valueLabel }) => ({
        id: valueId,
        label: valueLabel[language] ?? valueLabel.en,
      })),
    })),
  )

const getDriverLoginSetting = (
  { id: driverId, pair }: ManifestDriver,
  language: string,
): DriverSetting[] =>
  Object.values(
    Object.entries(
      pair?.find(
        (pairSetting): pairSetting is LoginSetting =>
          pairSetting.id === 'login',
      )?.options ?? [],
    ).reduce<Record<string, DriverSetting>>((acc, [option, label]) => {
      const isPassword = option.startsWith('password')
      const key = isPassword ? 'password' : 'username'
      acc[key] ??= {
        driverId,
        groupId: 'login',
        id: key,
        title: '',
        type: isPassword ? 'password' : 'text',
      }
      acc[key][option.endsWith('Placeholder') ? 'placeholder' : 'title'] =
        label[language] ?? label.en
      return acc
    }, {}),
  )

const getLocalizedCapabilitiesOptions = (
  options: ManifestDriverCapabilitiesOptions,
  language: string,
  enumType?:
    | typeof FanSpeed
    | typeof Horizontal
    | typeof OperationMode
    | typeof Vertical,
): DriverCapabilitiesOptions => ({
  title: options.title[language] ?? options.title.en,
  type: options.type,
  values: options.values?.map(({ id, title }) => ({
    id:
      enumType && id in enumType ?
        String(enumType[id as keyof typeof enumType])
      : id,
    label: title[language] ?? title.en,
  })),
})

export = {
  getAtaCapabilities({
    homey,
  }: {
    homey: Homey
  }): [keyof GroupAtaState, DriverCapabilitiesOptions][] {
    const language = homey.i18n.getLanguage()
    return [
      { key: 'Power', options: power },
      { key: 'SetTemperature', options: setTemperature },
      {
        enumType: FanSpeed,
        key: 'FanSpeed',
        options: { ...fanSpeed, type: 'enum', values: fanSpeedValues },
      },
      { enumType: Vertical, key: 'VaneVerticalDirection', options: vertical },
      {
        enumType: Horizontal,
        key: 'VaneHorizontalDirection',
        options: horizontal,
      },
      {
        enumType: OperationMode,
        key: 'OperationMode',
        options: {
          ...thermostatMode,
          values: (homey.manifest as Manifest).drivers
            .find(({ id }) => id === 'melcloud')
            ?.capabilitiesOptions?.thermostat_mode.values?.filter(
              ({ id }) => id !== 'off',
            ),
        },
      },
    ].map(({ enumType, key, options }) => [
      key as keyof GroupAtaState,
      getLocalizedCapabilitiesOptions(options, language, enumType),
    ])
  },
  async getAtaValues({
    homey,
    params: { zoneId, zoneType },
  }: {
    homey: Homey
    params: ZoneData
  }): Promise<GroupAtaState> {
    return getFacade(homey, zoneType, Number(zoneId)).getAta()
  },
  getBuildings(): BuildingZone[] {
    return BuildingModel.getAll().sort(compareNames).map(mapBuilding)
  },
  getDeviceSettings({ homey }: { homey: Homey }): DeviceSettings {
    return (homey.app as MELCloudApp)
      .getDevices()
      .reduce<DeviceSettings>((acc, device) => {
        const driverId = device.driver.id
        acc[driverId] ??= {}
        Object.entries(device.getSettings() as Settings).forEach(
          ([settingId, value]) => {
            acc[driverId][settingId] ??= []
            if (!acc[driverId][settingId].includes(value)) {
              acc[driverId][settingId].push(value)
            }
          },
        )
        return acc
      }, {})
  },
  getDriverSettings({
    homey,
  }: {
    homey: Homey
  }): Partial<Record<string, DriverSetting[]>> {
    const language = homey.i18n.getLanguage()
    return Object.groupBy(
      (homey.manifest as Manifest).drivers.flatMap((driver) => [
        ...getDriverSettings(driver, language),
        ...getDriverLoginSetting(driver, language),
      ]),
      ({ driverId, groupId }) => groupId ?? driverId,
    )
  },
  async getErrors({
    homey,
    query,
  }: {
    homey: Homey
    query: ErrorLogQuery
  }): Promise<ErrorLog> {
    return (homey.app as MELCloudApp).facadeManager.getErrors(query)
  },
  async getFrostProtectionSettings({
    homey,
    params: { zoneId, zoneType },
  }: {
    homey: Homey
    params: ZoneData
  }): Promise<FrostProtectionData> {
    return getFacade(homey, zoneType, Number(zoneId)).getFrostProtection()
  },
  async getHolidayModeSettings({
    homey,
    params: { zoneId, zoneType },
  }: {
    homey: Homey
    params: ZoneData
  }): Promise<HolidayModeData> {
    return getFacade(homey, zoneType, Number(zoneId)).getHolidayMode()
  },
  getLanguage({ homey }: { homey: Homey }): string {
    return homey.i18n.getLanguage()
  },
  async login({
    body,
    homey,
  }: {
    body: LoginCredentials
    homey: Homey
  }): Promise<boolean> {
    return (homey.app as MELCloudApp).api.login(body)
  },
  async setAtaValues({
    body,
    homey,
    params: { zoneId, zoneType },
  }: {
    body: GroupAtaState
    homey: Homey
    params: ZoneData
  }): Promise<void> {
    handleResponse(
      (await getFacade(homey, zoneType, Number(zoneId)).setAta(body))
        .AttributeErrors,
    )
  },
  async setDeviceSettings({
    body,
    homey,
    query,
  }: {
    query?: { driverId: string }
    body: Settings
    homey: Homey
  }): Promise<void> {
    await Promise.all(
      (homey.app as MELCloudApp)
        .getDevices({ driverId: query?.driverId })
        .map(async (device) => {
          const changedKeys = Object.keys(body).filter(
            (changedKey) => body[changedKey] !== device.getSetting(changedKey),
          )
          if (changedKeys.length) {
            await device.setSettings(
              Object.fromEntries(changedKeys.map((key) => [key, body[key]])),
            )
            await device.onSettings({
              changedKeys,
              newSettings: device.getSettings() as Settings,
            })
          }
        }),
    )
  },
  async setFrostProtectionSettings({
    body,
    homey,
    params: { zoneId, zoneType },
  }: {
    body: FrostProtectionSettings
    homey: Homey
    params: ZoneData
  }): Promise<void> {
    handleResponse(
      (
        await getFacade(homey, zoneType, Number(zoneId)).setFrostProtection(
          body,
        )
      ).AttributeErrors,
    )
  },
  async setHolidayModeSettings({
    body: { enabled, from, to },
    homey,
    params: { zoneId, zoneType },
  }: {
    body: HolidayModeSettings
    homey: Homey
    params: ZoneData
  }): Promise<void> {
    handleResponse(
      (
        await getFacade(homey, zoneType, Number(zoneId)).setHolidayMode({
          enabled,
          from,
          to,
        })
      ).AttributeErrors,
    )
  },
}
