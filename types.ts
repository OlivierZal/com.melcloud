import type MELCloudDeviceAta from './drivers/melcloud/device'
import type MELCloudDriverAta from './drivers/melcloud/driver'
import type MELCloudDeviceAtw from './drivers/melcloud_atw/device'
import type MELCloudDriverAtw from './drivers/melcloud_atw/driver'

export type MELCloudDevice = MELCloudDeviceAta | MELCloudDeviceAtw
export type MELCloudDriver = MELCloudDriverAta | MELCloudDriverAtw

export type SyncFromMode = 'syncFrom'
export type SyncMode = 'syncTo' | SyncFromMode

export type CapabilityValue = boolean | number | string

export type SettingValue = boolean | number | string | null | undefined

export interface Settings extends Record<string, SettingValue> {
  always_on?: boolean
}

export interface Store {
  readonly canCool: boolean
  readonly hasZone2: boolean
}

export interface ManifestDriverSettingData {
  readonly id: string
  readonly label: Record<string, string>
  readonly max?: number
  readonly min?: number
  readonly type: string
  readonly units?: string
  readonly values?: Array<{ id: string; label: Record<string, string> }>
}

export interface ManifestDriverSetting {
  readonly children?: ManifestDriverSettingData[]
  readonly id?: string
  readonly label: Record<string, string>
}

export type PairSetting = { id: string }

export interface LoginSetting extends PairSetting {
  readonly id: 'login'
  readonly options: {
    readonly passwordLabel: Record<string, string>
    readonly passwordPlaceholder: Record<string, string>
    readonly usernameLabel: Record<string, string>
    readonly usernamePlaceholder: Record<string, string>
  }
}

export interface ManifestDriver {
  readonly capabilitiesOptions?: Record<
    string,
    { readonly title?: Record<string, string> }
  >
  readonly id: string
  readonly pair?: LoginSetting & PairSetting[]
  readonly settings?: ManifestDriverSetting[]
}

export interface DriverSetting {
  readonly driverId: string
  readonly groupId?: string
  readonly groupLabel?: string
  readonly id: string
  readonly max?: number
  readonly min?: number
  placeholder?: string
  title: string
  readonly type: string
  readonly units?: string
  readonly values?: Array<{ id: string; label: string }>
}

export type DeviceSetting = Record<string, SettingValue[]>

export type DeviceSettings = Record<string, DeviceSetting>

export interface SuccessData {
  readonly AttributeErrors: null
}

export interface FailureData {
  readonly AttributeErrors: Record<string, string[]>
}

interface SetCapabilitiesMixin {
  onoff?: boolean
  target_temperature?: number
}

interface SetCapabilitiesAta extends SetCapabilitiesMixin {
  fan_power?: number
  horizontal?: string
  operation_mode?: string
  vertical?: string
}

interface SetCapabilitiesAtw extends SetCapabilitiesMixin {
  'onoff.forced_hot_water'?: boolean
  'operation_mode_zone.zone1'?: string
  'operation_mode_zone.zone2'?: string
  'operation_mode_zone_with_cool.zone1'?: string
  'operation_mode_zone_with_cool.zone2'?: string
  'target_temperature.tank_water'?: number
  'target_temperature.zone1_flow_cool'?: number
  'target_temperature.zone1_flow_heat'?: number
  'target_temperature.zone2'?: number
  'target_temperature.zone2_flow_cool'?: number
  'target_temperature.zone2_flow_heat'?: number
}

interface GetCapabilitiesMixin {
  readonly measure_temperature: number
}

interface GetCapabilitiesAta extends GetCapabilitiesMixin {}

interface GetCapabilitiesAtw extends GetCapabilitiesMixin {
  readonly 'alarm_generic.eco_hot_water': boolean
  readonly 'measure_temperature.outdoor': number
  readonly 'measure_temperature.tank_water': number
  readonly 'measure_temperature.zone2': number
  readonly operation_mode_state: number
  readonly 'operation_mode_state.zone1': number
  readonly 'operation_mode_state.zone2': number
}

interface ListCapabilitiesMixin {
  readonly 'measure_power.wifi': number
}

interface ListCapabilitiesAta extends ListCapabilitiesMixin {
  readonly fan_power: number
  readonly fan_power_state: number
  readonly horizontal: number
  readonly vertical: number
}

interface ListCapabilitiesAtw extends ListCapabilitiesMixin {
  readonly 'alarm_generic.booster_heater1': boolean
  readonly 'alarm_generic.booster_heater2': boolean
  readonly 'alarm_generic.booster_heater2_plus': boolean
  readonly 'alarm_generic.defrost_mode': boolean
  readonly 'alarm_generic.immersion_heater': boolean
  readonly last_legionella: string
  readonly measure_power: number
  readonly 'measure_power.heat_pump_frequency': number
  readonly 'measure_power.produced': number
  readonly 'measure_temperature.flow': number
  readonly 'measure_temperature.flow_zone1': number
  readonly 'measure_temperature.flow_zone2': number
  readonly 'measure_temperature.return': number
  readonly 'measure_temperature.return_zone1': number
  readonly 'measure_temperature.return_zone2': number
  readonly 'measure_temperature.tank_water_mixing': number
}

interface ReportCapabilitiesAta {
  measure_power?: number
  'measure_power.auto'?: number
  'measure_power.cooling'?: number
  'measure_power.dry'?: number
  'measure_power.fan'?: number
  'measure_power.heating'?: number
  'measure_power.other'?: number
  'meter_power.daily_consumed'?: number
  'meter_power.daily_consumed_auto'?: number
  'meter_power.daily_consumed_cooling'?: number
  'meter_power.daily_consumed_dry'?: number
  'meter_power.daily_consumed_fan'?: number
  'meter_power.daily_consumed_heating'?: number
  'meter_power.daily_consumed_other'?: number
  'meter_power.total_consumed'?: number
  'meter_power.total_consumed_auto'?: number
  'meter_power.total_consumed_cooling'?: number
  'meter_power.total_consumed_dry'?: number
  'meter_power.total_consumed_fan'?: number
  'meter_power.total_consumed_heating'?: number
  'meter_power.total_consumed_other'?: number
}

interface ReportCapabilitiesAtw {
  'meter_power.daily_consumed'?: number
  'meter_power.daily_consumed_cooling'?: number
  'meter_power.daily_consumed_heating'?: number
  'meter_power.daily_consumed_hotwater'?: number
  'meter_power.daily_cop'?: number
  'meter_power.daily_cop_cooling'?: number
  'meter_power.daily_cop_heating'?: number
  'meter_power.daily_cop_hotwater'?: number
  'meter_power.daily_produced'?: number
  'meter_power.daily_produced_cooling'?: number
  'meter_power.daily_produced_heating'?: number
  'meter_power.daily_produced_hotwater'?: number
  'meter_power.total_consumed'?: number
  'meter_power.total_consumed_cooling'?: number
  'meter_power.total_consumed_heating'?: number
  'meter_power.total_consumed_hotwater'?: number
  'meter_power.total_cop'?: number
  'meter_power.total_cop_cooling'?: number
  'meter_power.total_cop_heating'?: number
  'meter_power.total_cop_hotwater'?: number
  'meter_power.total_produced'?: number
  'meter_power.total_produced_cooling'?: number
  'meter_power.total_produced_heating'?: number
  'meter_power.total_produced_hotwater'?: number
}

export type SetCapability<T extends MELCloudDevice> =
  T extends MELCloudDeviceAtw
    ? keyof SetCapabilitiesAtw
    : keyof SetCapabilitiesAta

export type ExtendedSetCapability<T extends MELCloudDevice> =
  T extends MELCloudDeviceAtw
    ? SetCapability<MELCloudDeviceAtw>
    : SetCapability<MELCloudDeviceAta> | 'thermostat_mode'

export type GetCapability<T extends MELCloudDevice> =
  T extends MELCloudDeviceAtw
    ? keyof GetCapabilitiesAtw
    : keyof GetCapabilitiesAta

export type ListCapability<T extends MELCloudDevice> =
  T extends MELCloudDeviceAtw
    ? keyof ListCapabilitiesAtw
    : keyof ListCapabilitiesAta

export type ReportCapability<T extends MELCloudDevice> =
  T extends MELCloudDeviceAtw
    ? keyof ReportCapabilitiesAtw
    : keyof ReportCapabilitiesAta

export type NonReportCapability<T extends MELCloudDevice> =
  | SetCapability<T>
  | GetCapability<T>
  | ListCapability<T>

export type Capability<T extends MELCloudDevice> =
  | NonReportCapability<T>
  | ReportCapability<T>

export type ExtendedCapability<T extends MELCloudDevice> =
  | Capability<T>
  | ExtendedSetCapability<T>

interface BaseDeviceData {
  EffectiveFlags: number
  readonly Power: number
}

interface SetDeviceDataAta extends BaseDeviceData {
  readonly OperationMode: number
  readonly SetFanSpeed: number
  readonly SetTemperature: number
  readonly VaneHorizontal: number
  readonly VaneVertical: number
}

interface SetDeviceDataAtw extends BaseDeviceData {
  readonly ForcedHotWaterMode: boolean
  readonly OperationModeZone1: number
  readonly OperationModeZone2: number
  readonly SetCoolFlowTemperatureZone1: number
  readonly SetCoolFlowTemperatureZone2: number
  readonly SetHeatFlowTemperatureZone1: number
  readonly SetHeatFlowTemperatureZone2: number
  readonly SetTankWaterTemperature: number
  readonly SetTemperatureZone1: number
  readonly SetTemperatureZone2: number
}

export type SetDeviceData<T extends MELCloudDevice> =
  T extends MELCloudDeviceAtw ? SetDeviceDataAtw : SetDeviceDataAta

interface GetDeviceDataMixin extends BaseDeviceData {}

interface GetDeviceDataAta extends GetDeviceDataMixin, SetDeviceDataAta {
  readonly RoomTemperature: number
}

interface GetDeviceDataAtw extends GetDeviceDataMixin, SetDeviceDataAtw {
  readonly EcoHotWater: boolean
  readonly IdleZone1: boolean
  readonly IdleZone2: boolean
  readonly OperationMode: number
  readonly OutdoorTemperature: number
  readonly RoomTemperatureZone1: number
  readonly RoomTemperatureZone2: number
  readonly TankWaterTemperature: number
}

export type GetDeviceData<T extends MELCloudDevice> =
  T extends MELCloudDeviceAtw ? GetDeviceDataAtw : GetDeviceDataAta

export type PostData<T extends MELCloudDevice> = SetDeviceData<T> & {
  readonly DeviceID: number
  readonly HasPendingCommand: true
}

interface ListDeviceDataMixin extends BaseDeviceData {
  readonly CanCool: boolean
  readonly DeviceType: number
  readonly HasZone2: boolean
  readonly WifiSignalStrength: number
}

interface ListDeviceDataAta
  extends ListDeviceDataMixin,
    Exclude<
      GetDeviceDataAta,
      'SetFanSpeed' | 'VaneHorizontal' | 'VaneVertical'
    > {
  readonly ActualFanSpeed: number
  readonly FanSpeed: number
  readonly VaneHorizontalDirection: number
  readonly VaneVerticalDirection: number
}

interface ListDeviceDataAtw extends ListDeviceDataMixin, GetDeviceDataAtw {
  readonly BoosterHeater1Status: boolean
  readonly BoosterHeater2PlusStatus: boolean
  readonly BoosterHeater2Status: boolean
  readonly CurrentEnergyConsumed: number
  readonly CurrentEnergyProduced: number
  readonly DefrostMode: number
  readonly FlowTemperature: number
  readonly FlowTemperatureZone1: number
  readonly FlowTemperatureZone2: number
  readonly HeatPumpFrequency: number
  readonly ImmersionHeaterStatus: boolean
  readonly LastLegionellaActivationTime: string
  readonly MixingTankWaterTemperature: number
  readonly ReturnTemperature: number
  readonly ReturnTemperatureZone1: number
  readonly ReturnTemperatureZone2: number
}

export type ListDeviceData<T extends MELCloudDevice> =
  T extends MELCloudDeviceAtw ? ListDeviceDataAtw : ListDeviceDataAta

export interface ReportPostData {
  readonly DeviceID: number
  readonly FromDate: string
  readonly ToDate: string
  readonly UseCurrency: false
}

interface ReportDataAta {
  readonly Auto: number[]
  readonly Cooling: number[]
  readonly Dry: number[]
  readonly Fan: number[]
  readonly Heating: number[]
  readonly Other: number[]
  readonly TotalAutoConsumed: number
  readonly TotalCoolingConsumed: number
  readonly TotalDryConsumed: number
  readonly TotalFanConsumed: number
  readonly TotalHeatingConsumed: number
  readonly TotalOtherConsumed: number
  readonly UsageDisclaimerPercentages: string
}

interface ReportDataAtw {
  readonly CoP: number[]
  readonly TotalCoolingConsumed: number
  readonly TotalCoolingProduced: number
  readonly TotalHeatingConsumed: number
  readonly TotalHeatingProduced: number
  readonly TotalHotWaterConsumed: number
  readonly TotalHotWaterProduced: number
}

export type ReportData<T extends MELCloudDevice> = T extends MELCloudDeviceAtw
  ? ReportDataAtw
  : ReportDataAta

export interface SetCapabilityMapping<T extends MELCloudDevice> {
  readonly effectiveFlag: bigint
  readonly tag: Exclude<keyof SetDeviceData<T>, 'EffectiveFlags'>
}

export interface GetCapabilityMapping<T extends MELCloudDevice> {
  readonly tag: Exclude<keyof GetDeviceData<T>, 'EffectiveFlags'>
}

export interface ListCapabilityMapping<T extends MELCloudDevice> {
  readonly effectiveFlag?: bigint
  readonly tag: Exclude<keyof ListDeviceData<T>, 'EffectiveFlags'>
}

export type ReportCapabilityMapping<T extends MELCloudDevice> = Array<
  keyof ReportData<T>
>

export const setCapabilityMappingAta: Record<
  SetCapability<MELCloudDeviceAta>,
  SetCapabilityMapping<MELCloudDeviceAta>
> = {
  onoff: {
    tag: 'Power',
    effectiveFlag: 0x1n,
  },
  operation_mode: {
    tag: 'OperationMode',
    effectiveFlag: 0x2n,
  },
  target_temperature: {
    tag: 'SetTemperature',
    effectiveFlag: 0x4n,
  },
  fan_power: {
    tag: 'SetFanSpeed',
    effectiveFlag: 0x8n,
  },
  vertical: {
    tag: 'VaneVertical',
    effectiveFlag: 0x10n,
  },
  horizontal: {
    tag: 'VaneHorizontal',
    effectiveFlag: 0x100n,
  },
} as const

export const setCapabilityMappingAtw: Record<
  SetCapability<MELCloudDeviceAtw>,
  SetCapabilityMapping<MELCloudDeviceAtw>
> = {
  onoff: {
    tag: 'Power',
    effectiveFlag: 0x1n,
  },
  'operation_mode_zone.zone1': {
    tag: 'OperationModeZone1',
    effectiveFlag: 0x8n,
  },
  'operation_mode_zone_with_cool.zone1': {
    tag: 'OperationModeZone1',
    effectiveFlag: 0x8n,
  },
  'operation_mode_zone.zone2': {
    tag: 'OperationModeZone2',
    effectiveFlag: 0x10n,
  },
  'operation_mode_zone_with_cool.zone2': {
    tag: 'OperationModeZone2',
    effectiveFlag: 0x10n,
  },
  'onoff.forced_hot_water': {
    tag: 'ForcedHotWaterMode',
    effectiveFlag: 0x10000n,
  },
  target_temperature: {
    tag: 'SetTemperatureZone1',
    effectiveFlag: 0x200000080n,
  },
  'target_temperature.zone2': {
    tag: 'SetTemperatureZone2',
    effectiveFlag: 0x800000200n,
  },
  'target_temperature.zone1_flow_cool': {
    tag: 'SetCoolFlowTemperatureZone1',
    effectiveFlag: 0x1000000000000n,
  },
  'target_temperature.zone1_flow_heat': {
    tag: 'SetHeatFlowTemperatureZone1',
    effectiveFlag: 0x1000000000000n,
  },
  'target_temperature.zone2_flow_cool': {
    tag: 'SetCoolFlowTemperatureZone2',
    effectiveFlag: 0x1000000000000n,
  },
  'target_temperature.zone2_flow_heat': {
    tag: 'SetHeatFlowTemperatureZone2',
    effectiveFlag: 0x1000000000000n,
  },
  'target_temperature.tank_water': {
    tag: 'SetTankWaterTemperature',
    effectiveFlag: 0x1000000000020n,
  },
} as const

export const getCapabilityMappingAta: Record<
  GetCapability<MELCloudDeviceAta>,
  GetCapabilityMapping<MELCloudDeviceAta>
> = {
  measure_temperature: {
    tag: 'RoomTemperature',
  },
} as const

export const getCapabilityMappingAtw: Record<
  GetCapability<MELCloudDeviceAtw>,
  GetCapabilityMapping<MELCloudDeviceAtw>
> = {
  'alarm_generic.eco_hot_water': {
    tag: 'EcoHotWater',
  },
  measure_temperature: {
    tag: 'RoomTemperatureZone1',
  },
  'measure_temperature.zone2': {
    tag: 'RoomTemperatureZone2',
  },
  'measure_temperature.outdoor': {
    tag: 'OutdoorTemperature',
  },
  'measure_temperature.tank_water': {
    tag: 'TankWaterTemperature',
  },
  operation_mode_state: {
    tag: 'OperationMode',
  },
  // Must follow `operation_mode_state`
  'operation_mode_state.zone1': {
    tag: 'IdleZone1',
  },
  'operation_mode_state.zone2': {
    tag: 'IdleZone2',
  },
} as const

const listCapabilityMappingMixin: Record<
  keyof ListCapabilitiesMixin,
  ListCapabilityMapping<MELCloudDevice>
> = {
  'measure_power.wifi': {
    tag: 'WifiSignalStrength',
  },
} as const

export const listCapabilityMappingAta: Record<
  ListCapability<MELCloudDeviceAta>,
  ListCapabilityMapping<MELCloudDeviceAta>
> = {
  ...listCapabilityMappingMixin,
  fan_power: {
    tag: 'FanSpeed',
  },
  fan_power_state: {
    tag: 'ActualFanSpeed',
  },
  vertical: {
    tag: 'VaneVerticalDirection',
  },
  horizontal: {
    tag: 'VaneHorizontalDirection',
  },
} as const

export const listCapabilityMappingAtw: Record<
  ListCapability<MELCloudDeviceAtw>,
  ListCapabilityMapping<MELCloudDeviceAtw>
> = {
  ...listCapabilityMappingMixin,
  'alarm_generic.booster_heater1': {
    tag: 'BoosterHeater1Status',
  },
  'alarm_generic.booster_heater2': {
    tag: 'BoosterHeater2Status',
  },
  'alarm_generic.booster_heater2_plus': {
    tag: 'BoosterHeater2PlusStatus',
  },
  'alarm_generic.defrost_mode': {
    tag: 'DefrostMode',
  },
  'alarm_generic.immersion_heater': {
    tag: 'ImmersionHeaterStatus',
  },
  last_legionella: {
    tag: 'LastLegionellaActivationTime',
  },
  measure_power: {
    tag: 'CurrentEnergyConsumed',
  },
  'measure_power.produced': {
    tag: 'CurrentEnergyProduced',
  },
  'measure_power.heat_pump_frequency': {
    tag: 'HeatPumpFrequency',
  },
  'measure_temperature.flow': {
    tag: 'FlowTemperature',
  },
  'measure_temperature.flow_zone1': {
    tag: 'FlowTemperatureZone1',
  },
  'measure_temperature.flow_zone2': {
    tag: 'FlowTemperatureZone2',
  },
  'measure_temperature.return': {
    tag: 'ReturnTemperature',
  },
  'measure_temperature.return_zone1': {
    tag: 'ReturnTemperatureZone1',
  },
  'measure_temperature.return_zone2': {
    tag: 'ReturnTemperatureZone2',
  },
  'measure_temperature.tank_water_mixing': {
    tag: 'MixingTankWaterTemperature',
  },
} as const

export const reportCapabilityMappingAta: Record<
  ReportCapability<MELCloudDeviceAta>,
  ReportCapabilityMapping<MELCloudDeviceAta>
> = {
  measure_power: ['Auto', 'Cooling', 'Dry', 'Fan', 'Heating', 'Other'],
  'measure_power.auto': ['Auto'],
  'measure_power.cooling': ['Cooling'],
  'measure_power.dry': ['Dry'],
  'measure_power.fan': ['Fan'],
  'measure_power.heating': ['Heating'],
  'measure_power.other': ['Other'],
  'meter_power.daily_consumed': [
    'TotalAutoConsumed',
    'TotalCoolingConsumed',
    'TotalDryConsumed',
    'TotalFanConsumed',
    'TotalHeatingConsumed',
    'TotalOtherConsumed',
  ],
  'meter_power.daily_consumed_auto': ['TotalAutoConsumed'],
  'meter_power.daily_consumed_cooling': ['TotalCoolingConsumed'],
  'meter_power.daily_consumed_dry': ['TotalDryConsumed'],
  'meter_power.daily_consumed_fan': ['TotalFanConsumed'],
  'meter_power.daily_consumed_heating': ['TotalHeatingConsumed'],
  'meter_power.daily_consumed_other': ['TotalOtherConsumed'],
  'meter_power.total_consumed': [
    'TotalAutoConsumed',
    'TotalCoolingConsumed',
    'TotalDryConsumed',
    'TotalFanConsumed',
    'TotalHeatingConsumed',
    'TotalOtherConsumed',
  ],
  'meter_power.total_consumed_auto': ['TotalAutoConsumed'],
  'meter_power.total_consumed_cooling': ['TotalCoolingConsumed'],
  'meter_power.total_consumed_dry': ['TotalDryConsumed'],
  'meter_power.total_consumed_fan': ['TotalFanConsumed'],
  'meter_power.total_consumed_heating': ['TotalHeatingConsumed'],
  'meter_power.total_consumed_other': ['TotalOtherConsumed'],
}

export const reportCapabilityMappingAtw: Record<
  ReportCapability<MELCloudDeviceAtw>,
  ReportCapabilityMapping<MELCloudDeviceAtw>
> = {
  'meter_power.daily_cop': ['CoP'],
  'meter_power.daily_cop_cooling': [
    'TotalCoolingProduced',
    'TotalCoolingConsumed',
  ],
  'meter_power.daily_cop_heating': [
    'TotalHeatingProduced',
    'TotalHeatingConsumed',
  ],
  'meter_power.daily_cop_hotwater': [
    'TotalHotWaterProduced',
    'TotalHotWaterConsumed',
  ],
  'meter_power.daily_consumed': [
    'TotalCoolingConsumed',
    'TotalHeatingConsumed',
    'TotalHotWaterConsumed',
  ],
  'meter_power.daily_consumed_cooling': ['TotalCoolingConsumed'],
  'meter_power.daily_consumed_heating': ['TotalHeatingConsumed'],
  'meter_power.daily_consumed_hotwater': ['TotalHotWaterConsumed'],
  'meter_power.daily_produced': [
    'TotalCoolingProduced',
    'TotalHeatingProduced',
    'TotalHotWaterProduced',
  ],
  'meter_power.daily_produced_cooling': ['TotalCoolingProduced'],
  'meter_power.daily_produced_heating': ['TotalHeatingProduced'],
  'meter_power.daily_produced_hotwater': ['TotalHotWaterProduced'],
  'meter_power.total_cop': ['CoP'],
  'meter_power.total_cop_cooling': [
    'TotalCoolingProduced',
    'TotalCoolingConsumed',
  ],
  'meter_power.total_cop_heating': [
    'TotalHeatingProduced',
    'TotalHeatingConsumed',
  ],
  'meter_power.total_cop_hotwater': [
    'TotalHotWaterProduced',
    'TotalHotWaterConsumed',
  ],
  'meter_power.total_consumed': [
    'TotalCoolingConsumed',
    'TotalHeatingConsumed',
    'TotalHotWaterConsumed',
  ],
  'meter_power.total_consumed_cooling': ['TotalCoolingConsumed'],
  'meter_power.total_consumed_heating': ['TotalHeatingConsumed'],
  'meter_power.total_consumed_hotwater': ['TotalHotWaterConsumed'],
  'meter_power.total_produced': [
    'TotalCoolingProduced',
    'TotalHeatingProduced',
    'TotalHotWaterProduced',
  ],
  'meter_power.total_produced_cooling': ['TotalCoolingProduced'],
  'meter_power.total_produced_heating': ['TotalHeatingProduced'],
  'meter_power.total_produced_hotwater': ['TotalHotWaterProduced'],
}

export interface DeviceDetails {
  readonly capabilities: string[]
  readonly data: {
    readonly buildingid: number
    readonly id: number
  }
  readonly name: string
  readonly store: Store
}

export interface FlowArgsAta
  extends Record<Readonly<SetCapability<MELCloudDeviceAta>>, string> {
  readonly device: MELCloudDeviceAta
}

export interface LoginCredentials {
  password: string
  username: string
}

export interface LoginPostData {
  readonly AppVersion: '1.26.2.0'
  readonly Email: string
  readonly Password: string
  readonly Persist: true
}

export interface LoginData {
  readonly LoginData?: {
    readonly ContextKey: string
    readonly Expiry: string
  }
}

export interface FrostProtectionSettings {
  readonly Enabled: boolean
  readonly MaximumTemperature: number
  readonly MinimumTemperature: number
}

export interface FrostProtectionPostData extends FrostProtectionSettings {
  readonly BuildingIds: [number]
}

export interface FrostProtectionData {
  readonly FPEnabled: boolean
  readonly FPMaxTemperature: number
  readonly FPMinTemperature: number
}

export interface HolidayModeSettings {
  readonly Enabled: boolean
  readonly EndDate: string
  readonly StartDate: string
}

export interface HolidayModePostData {
  readonly Enabled: boolean
  readonly EndDate: {
    readonly Day: number
    readonly Hour: number
    readonly Minute: number
    readonly Month: number
    readonly Second: number
    readonly Year: number
  } | null
  readonly HMTimeZones: [
    {
      readonly Buildings: [number]
    }
  ]
  readonly StartDate: {
    readonly Day: number
    readonly Hour: number
    readonly Minute: number
    readonly Month: number
    readonly Second: number
    readonly Year: number
  } | null
}

export interface HolidayModeData {
  readonly HMEnabled: boolean
  readonly HMEndDate: string | null
  readonly HMStartDate: string | null
}

interface BaseListDevice {
  readonly BuildingID: number
  readonly DeviceID: number
  readonly DeviceName: string
}

export interface ListDevice<T extends MELCloudDevice> extends BaseListDevice {
  readonly Device: ListDeviceData<T>
}

export interface Structure<T extends MELCloudDevice> {
  readonly Areas: Array<{
    readonly Devices: Array<ListDevice<T>>
  }>
  readonly Devices: Array<ListDevice<T>>
  readonly Floors: Array<{
    readonly Areas: Array<{
      readonly Devices: Array<ListDevice<T>>
    }>
    readonly Devices: Array<ListDevice<T>>
  }>
}

export interface Building<T extends MELCloudDevice>
  extends FrostProtectionData,
    HolidayModeData {
  readonly ID: number
  readonly Name: string
  readonly Structure: Structure<T>
}

export interface ErrorLogQuery {
  readonly from?: string
  readonly limit?: string
  readonly offset?: string
  readonly to?: string
}

export interface ErrorLogPostData {
  readonly DeviceIDs: string[]
  readonly FromDate: string
  readonly ToDate: string
}

export interface ErrorLogData {
  readonly DeviceId: number
  readonly Duration: number
  readonly EndDate: string
  readonly ErrorMessage: string
  readonly StartDate: string
}

export interface ErrorDetails {
  readonly Date: string
  readonly Device: string
  readonly Error: string
}

export interface ErrorLog {
  readonly Errors: ErrorDetails[]
  readonly FromDateHuman: string
  readonly NextFromDate: string
  readonly NextToDate: string
}
