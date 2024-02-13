import type {
  Building,
  DeviceData,
  DeviceDataFromGet,
  ErrorLogData,
  ErrorLogPostData,
  FailureData,
  FrostProtectionData,
  FrostProtectionPostData,
  HeatPumpType,
  HolidayModeData,
  HolidayModePostData,
  LoginData,
  LoginPostData,
  MELCloudDriver,
  PostData,
  ReportData,
  ReportPostData,
  SuccessData,
} from '../types'
import { DateTime, Duration } from 'luxon'
import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import type { APICallContextDataWithErrorMessage } from '../mixins/withErrorMessage'
import APICallRequestData from './APICallRequestData'
import APICallResponseData from './APICallResponseData'
import type Homey from 'homey/lib/Homey'
import type MELCloudApp from '../app'
import createAPICallErrorData from './APICallErrorData'

const LIST_URL = '/User/ListDevices'
const LOGIN_URL = '/Login/ClientLogin'

export default class MELCloudAPI {
  public static readonly instance: MELCloudAPI

  readonly #api: AxiosInstance

  readonly #app: MELCloudApp

  #holdAPIListUntil: DateTime = DateTime.now()

  #retry = true

  #retryTimeout!: NodeJS.Timeout

  public constructor(homey: Homey) {
    this.#app = homey.app as MELCloudApp
    this.#api = axios.create({
      baseURL: 'https://app.melcloud.com/Mitsubishi.Wifi.Client',
      headers: { 'X-MitsContextKey': this.#app.getHomeySetting('contextKey') },
    })
    this.setupAxiosInterceptors()
  }

  public static getInstance(homey: Homey): MELCloudAPI {
    return typeof MELCloudAPI.instance === 'undefined'
      ? new MELCloudAPI(homey)
      : MELCloudAPI.instance
  }

  public async login(postData: LoginPostData): Promise<{ data: LoginData }> {
    const response = await this.#api.post<LoginData>(LOGIN_URL, postData)
    if (response.data.LoginData) {
      const { ContextKey: contextKey, Expiry: expiry } = response.data.LoginData
      this.#app.setHomeySettings({ contextKey, expiry })
      this.#api.defaults.headers.common['X-MitsContextKey'] = contextKey
    }
    return response
  }

  public async list(): Promise<{ data: Building[] }> {
    return this.#api.get<Building[]>(LIST_URL)
  }

  public async set<D extends MELCloudDriver>(
    heatPumpType: keyof typeof HeatPumpType,
    postData: PostData<D>,
  ): Promise<{ data: DeviceData<D> }> {
    return this.#api.post<DeviceData<D>>(`/Device/Set${heatPumpType}`, postData)
  }

  public async get<D extends MELCloudDriver>(
    id: number,
    buildingId: number,
  ): Promise<{ data: DeviceDataFromGet<D> }> {
    return this.#api.get<DeviceDataFromGet<D>>('/Device/Get', {
      params: { buildingId, id },
    })
  }

  public async report<D extends MELCloudDriver>(
    postData: ReportPostData,
  ): Promise<{ data: ReportData<D> }> {
    return this.#api.post<ReportData<D>>('/EnergyCost/Report', postData)
  }

  public async error(
    postData: ErrorLogPostData,
  ): Promise<{ data: ErrorLogData[] | FailureData }> {
    return this.#api.post<ErrorLogData[] | FailureData>(
      '/Report/GetUnitErrorLog2',
      postData,
    )
  }

  public async getFrostProtection(
    id: number,
  ): Promise<{ data: FrostProtectionData }> {
    return this.#api.get<FrostProtectionData>('/FrostProtection/GetSettings', {
      params: { id, tableName: 'DeviceLocation' },
    })
  }

  public async updateFrostProtection(
    postData: FrostProtectionPostData,
  ): Promise<{ data: FailureData | SuccessData }> {
    return this.#api.post<FailureData | SuccessData>(
      '/FrostProtection/Update',
      postData,
    )
  }

  public async getHolidayMode(id: number): Promise<{ data: HolidayModeData }> {
    return this.#api.get<HolidayModeData>('/HolidayMode/GetSettings', {
      params: { id, tableName: 'DeviceLocation' },
    })
  }

  public async updateHolidayMode(
    postData: HolidayModePostData,
  ): Promise<{ data: FailureData | SuccessData }> {
    return this.#api.post<FailureData | SuccessData>(
      '/HolidayMode/Update',
      postData,
    )
  }

  private setupAxiosInterceptors(): void {
    this.#api.interceptors.request.use(
      async (
        config: InternalAxiosRequestConfig,
      ): Promise<InternalAxiosRequestConfig> => this.handleRequest(config),
      async (error: AxiosError): Promise<AxiosError> => this.handleError(error),
    )
    this.#api.interceptors.response.use(
      (response: AxiosResponse): AxiosResponse => this.handleResponse(response),
      async (error: AxiosError): Promise<AxiosError> => this.handleError(error),
    )
  }

  private async handleRequest(
    config: InternalAxiosRequestConfig,
  ): Promise<InternalAxiosRequestConfig> {
    if (config.url === LIST_URL && this.#holdAPIListUntil > DateTime.now()) {
      return Promise.reject(
        new Error(
          `API requests to ${LIST_URL} are on hold for ${this.#holdAPIListUntil
            .diffNow()
            .shiftTo('minutes', 'seconds')
            .toHuman()}`,
        ),
      )
    }
    this.#app.log(String(new APICallRequestData(config)))
    return config
  }

  private handleResponse(response: AxiosResponse): AxiosResponse {
    this.#app.log(String(new APICallResponseData(response)))
    return response
  }

  private async handleError(error: AxiosError): Promise<AxiosError> {
    const apiCallData: APICallContextDataWithErrorMessage =
      createAPICallErrorData(error)
    this.#app.error(String(apiCallData))
    switch (error.response?.status) {
      case axios.HttpStatusCode.Unauthorized:
        if (this.#retry && error.config?.url !== LOGIN_URL) {
          this.handleRetry()
          if ((await this.#app.login()) && error.config) {
            return this.#api.request(error.config)
          }
        }
        break
      case axios.HttpStatusCode.TooManyRequests:
        this.#holdAPIListUntil = DateTime.now().plus({ minutes: 30 })
        break
      default:
    }
    return Promise.reject(error)
  }

  private handleRetry(): void {
    this.#retry = false
    clearTimeout(this.#retryTimeout)
    this.#retryTimeout = setTimeout(
      () => {
        this.#retry = true
      },
      Duration.fromObject({ minutes: 1 }).as('milliseconds'),
    )
  }
}
