export const APP_VERSION = '1.32.1.0'
export const FLAG_UNCHANGED = 0

export enum HeatPumpType {
  Ata = 0,
  Atw = 1,
  Erv = 3,
}

export enum OperationMode {
  heat = 1,
  dry = 2,
  cool = 3,
  fan = 7,
  auto = 8,
}
export enum Vertical {
  auto = 0,
  upwards = 1,
  mid_high = 2,
  middle = 3,
  mid_low = 4,
  downwards = 5,
  swing = 7,
}
export enum Horizontal {
  auto = 0,
  leftwards = 1,
  center_left = 2,
  center = 3,
  center_right = 4,
  rightwards = 5,
  swing = 12,
}

export enum OperationModeState {
  idle = 0,
  dhw = 1,
  heating = 2,
  cooling = 3,
  defrost = 5,
  legionella = 6,
}
export enum OperationModeZone {
  room = 0,
  flow = 1,
  curve = 2,
  room_cool = 3,
  flow_cool = 4,
}

export enum VentilationMode {
  recovery = 0,
  bypass = 1,
  auto = 2,
}

interface BaseDeviceData {
  EffectiveFlags: number
  readonly Power?: boolean
}
interface BasePostData {
  readonly DeviceID: number
  readonly HasPendingCommand: true
}
interface BaseDeviceDataFromList {
  readonly WifiSignalStrength: number
}

export interface SetDeviceDataAta extends BaseDeviceData {
  readonly OperationMode?: OperationMode
  readonly SetFanSpeed?: number
  readonly SetTemperature?: number
  readonly VaneHorizontal?: Horizontal
  readonly VaneVertical?: Vertical
}
export type PostDataAta = BasePostData & SetDeviceDataAta
export interface DeviceDataFromSetAta extends SetDeviceDataAta {
  readonly RoomTemperature: number
}
export type DeviceDataFromGetAta = DeviceDataFromSetAta & {
  readonly EffectiveFlags: typeof FLAG_UNCHANGED
}
export interface DeviceDataFromListAta
  extends BaseDeviceDataFromList,
    Omit<
      DeviceDataFromGetAta,
      'SetFanSpeed' | 'VaneHorizontal' | 'VaneVertical'
    > {
  readonly DeviceType: HeatPumpType.Ata
  readonly ActualFanSpeed: number
  readonly FanSpeed: number
  readonly VaneHorizontalDirection: Horizontal
  readonly VaneVerticalDirection: Vertical
}

export interface SetDeviceDataAtw extends BaseDeviceData {
  readonly ForcedHotWaterMode?: boolean
  readonly OperationModeZone1?: OperationModeZone
  readonly OperationModeZone2?: OperationModeZone
  readonly SetCoolFlowTemperatureZone1?: number
  readonly SetCoolFlowTemperatureZone2?: number
  readonly SetHeatFlowTemperatureZone1?: number
  readonly SetHeatFlowTemperatureZone2?: number
  readonly SetTankWaterTemperature?: number
  readonly SetTemperatureZone1?: number
  readonly SetTemperatureZone2?: number
}
export type PostDataAtw = BasePostData & SetDeviceDataAtw
export interface DeviceDataFromSetAtw extends SetDeviceDataAtw {
  readonly IdleZone1: boolean
  readonly IdleZone2: boolean
  readonly OperationMode: OperationModeState
  readonly OutdoorTemperature: number
  readonly RoomTemperatureZone1: number
  readonly RoomTemperatureZone2: number
  readonly TankWaterTemperature: number
}
export type DeviceDataFromGetAtw = DeviceDataFromSetAtw & {
  readonly EffectiveFlags: typeof FLAG_UNCHANGED
}
export interface DeviceDataFromListAtw
  extends BaseDeviceDataFromList,
    DeviceDataFromGetAtw {
  readonly DeviceType: HeatPumpType.Atw
  readonly BoosterHeater1Status: boolean
  readonly BoosterHeater2PlusStatus: boolean
  readonly BoosterHeater2Status: boolean
  readonly CanCool: boolean
  readonly CondensingTemperature: number
  readonly CurrentEnergyConsumed: number
  readonly CurrentEnergyProduced: number
  readonly DefrostMode: number
  readonly EcoHotWater: boolean
  readonly FlowTemperature: number
  readonly FlowTemperatureZone1: number
  readonly FlowTemperatureZone2: number
  readonly HasZone2: boolean
  readonly HeatPumpFrequency: number
  readonly ImmersionHeaterStatus: boolean
  readonly LastLegionellaActivationTime: string
  readonly MixingTankWaterTemperature: number
  readonly ReturnTemperature: number
  readonly ReturnTemperatureZone1: number
  readonly ReturnTemperatureZone2: number
  readonly TargetHCTemperatureZone1: number
  readonly TargetHCTemperatureZone2: number
}

export interface SetDeviceDataErv extends BaseDeviceData {
  readonly SetFanSpeed?: number
  readonly VentilationMode?: VentilationMode
}
export type PostDataErv = BasePostData & SetDeviceDataErv
export interface DeviceDataFromSetErv extends SetDeviceDataErv {
  readonly RoomCO2Level: number
  readonly RoomTemperature: number
  readonly OutdoorTemperature: number
}
export type DeviceDataFromGetErv = DeviceDataFromSetErv & {
  readonly EffectiveFlags: typeof FLAG_UNCHANGED
}
export interface DeviceDataFromListErv
  extends BaseDeviceDataFromList,
    DeviceDataFromGetErv {
  readonly DeviceType: HeatPumpType.Erv
  readonly HasCO2Sensor: boolean
  readonly HasPM25Sensor: boolean
  readonly PM25Level: number
}

export type PostDataAny = PostDataAta | PostDataAtw | PostDataErv
export type DeviceDataFromSet<D extends PostDataAny> = D extends PostDataAta
  ? DeviceDataFromSetAta
  : D extends PostDataAtw
    ? DeviceDataFromSetAtw
    : D extends PostDataErv
      ? DeviceDataFromSetErv
      : never
export type DeviceDataFromGetAny =
  | DeviceDataFromGetAta
  | DeviceDataFromGetAtw
  | DeviceDataFromGetErv
export type DeviceDataFromGet<D extends DeviceDataFromGetAny> =
  D extends DeviceDataFromGetAta
    ? DeviceDataFromGetAta
    : D extends DeviceDataFromGetAtw
      ? DeviceDataFromGetAtw
      : D extends DeviceDataFromGetErv
        ? DeviceDataFromGetErv
        : never

export interface ReportPostData {
  readonly DeviceID: number
  readonly FromDate: string
  readonly ToDate: string
  readonly UseCurrency: false
}
export interface ReportDataAta {
  readonly Auto: readonly number[]
  readonly Cooling: readonly number[]
  readonly Dry: readonly number[]
  readonly Fan: readonly number[]
  readonly Heating: readonly number[]
  readonly Other: readonly number[]
  readonly TotalAutoConsumed: number
  readonly TotalCoolingConsumed: number
  readonly TotalDryConsumed: number
  readonly TotalFanConsumed: number
  readonly TotalHeatingConsumed: number
  readonly TotalOtherConsumed: number
  readonly UsageDisclaimerPercentages: string
}
export interface ReportDataAtw {
  readonly CoP: readonly number[]
  readonly TotalCoolingConsumed: number
  readonly TotalCoolingProduced: number
  readonly TotalHeatingConsumed: number
  readonly TotalHeatingProduced: number
  readonly TotalHotWaterConsumed: number
  readonly TotalHotWaterProduced: number
}
export type ReportDataAny = ReportDataAta | ReportDataAtw

export interface LoginPostData {
  readonly AppVersion: typeof APP_VERSION
  readonly Email: string
  readonly Password: string
  readonly Persist: true
}
export interface LoginData {
  readonly LoginData: {
    readonly ContextKey: string
    readonly Expiry: string
  } | null
}

export interface FrostProtectionPostData {
  readonly Enabled: boolean
  readonly MaximumTemperature: number
  readonly MinimumTemperature: number
  readonly BuildingIds: [number]
}
export interface FrostProtectionData {
  FPEnabled: boolean
  FPMaxTemperature: number
  FPMinTemperature: number
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
  readonly HMTimeZones: [{ readonly Buildings: [number] }]
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
  HMEnabled: boolean
  HMEndDate: string | null
  HMStartDate: string | null
}

export interface SuccessData {
  readonly AttributeErrors: null
}
export interface FailureData {
  readonly AttributeErrors: Record<string, readonly string[]>
}

export interface BuildingData extends FrostProtectionData, HolidayModeData {}
interface BaseListDevice {
  readonly BuildingID: number
  readonly DeviceID: number
  readonly DeviceName: string
}
export interface ListDeviceAta extends BaseListDevice {
  readonly Device: DeviceDataFromListAta
}
export interface ListDeviceAtw extends BaseListDevice {
  readonly Device: DeviceDataFromListAtw
}
export interface ListDeviceErv extends BaseListDevice {
  readonly Device: DeviceDataFromListErv
}
export type ListDeviceAny = ListDeviceAta | ListDeviceAtw | ListDeviceErv
export interface Building extends Readonly<BuildingData> {
  readonly ID: number
  readonly Name: string
  readonly Structure: {
    readonly Areas: readonly { readonly Devices: readonly ListDeviceAny[] }[]
    readonly Devices: readonly ListDeviceAny[]
    readonly Floors: readonly {
      readonly Areas: readonly { readonly Devices: readonly ListDeviceAny[] }[]
      readonly Devices: readonly ListDeviceAny[]
    }[]
  }
}

export interface ErrorLogPostData {
  readonly DeviceIDs: readonly string[]
  readonly FromDate: string
  readonly ToDate: string
}
export interface ErrorLogData {
  readonly DeviceId: number
  readonly EndDate: string
  readonly ErrorMessage: string | null
  readonly StartDate: string
}
