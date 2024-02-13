/* eslint-disable no-console */
import {
  APP_VERSION,
  type Building,
  type DeviceData,
  type DeviceDataFromGet,
  type ErrorLogData,
  type ErrorLogPostData,
  type FailureData,
  type FrostProtectionData,
  type FrostProtectionPostData,
  type HeatPumpType,
  type HolidayModeData,
  type HolidayModePostData,
  type LoginData,
  type LoginPostData,
  type MELCloudDriver,
  type PostData,
  type ReportData,
  type ReportPostData,
  type SuccessData,
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
import createAPICallErrorData from './APICallErrorData'

interface SettingManager {
  get: (key: string) => string
  set: (key: string, value: string) => void
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Logger = (...args: any[]) => void

const LIST_URL = '/User/ListDevices'
const LOGIN_URL = '/Login/ClientLogin'

export default class MELCloudAPI {
  public static readonly instance: MELCloudAPI

  #holdAPIListUntil: DateTime = DateTime.now()

  #retry = true

  #retryTimeout!: NodeJS.Timeout

  readonly #settingManager: SettingManager

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly #logger: (...args: any[]) => void

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly #errorLogger: (...args: any[]) => void

  readonly #api: AxiosInstance

  public constructor(
    settingManager: SettingManager,
    logger: Logger = console.log,
    errorLogger: Logger = console.error,
  ) {
    this.#settingManager = settingManager
    this.#logger = logger
    this.#errorLogger = errorLogger
    this.#api = axios.create({
      baseURL: 'https://app.melcloud.com/Mitsubishi.Wifi.Client',
      headers: {
        'X-MitsContextKey': this.#settingManager.get('contextKey') as
          | string
          | null
          | undefined,
      },
    })
    this.#setupAxiosInterceptors()
  }

  public static getInstance(
    settingManager?: SettingManager,
    logger: Logger = console.log,
    errorLogger: Logger = console.error,
  ): MELCloudAPI {
    if (typeof MELCloudAPI.instance === 'undefined') {
      if (!settingManager) {
        throw new Error('SettingManager is required')
      }
      return new MELCloudAPI(settingManager, logger, errorLogger)
    }
    return MELCloudAPI.instance
  }

  public async login(postData: LoginPostData): Promise<{ data: LoginData }> {
    const response = await this.#api.post<LoginData>(LOGIN_URL, postData)
    if (response.data.LoginData) {
      const { Email: username, Password: password } = postData
      this.#settingManager.set('username', username)
      this.#settingManager.set('password', password)
      const { ContextKey: contextKey, Expiry: expiry } = response.data.LoginData
      this.#settingManager.set('contextKey', contextKey)
      this.#settingManager.set('expiry', expiry)
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

  #setupAxiosInterceptors(): void {
    this.#api.interceptors.request.use(
      async (
        config: InternalAxiosRequestConfig,
      ): Promise<InternalAxiosRequestConfig> => this.#handleRequest(config),
      async (error: AxiosError): Promise<AxiosError> =>
        this.#handleError(error),
    )
    this.#api.interceptors.response.use(
      (response: AxiosResponse): AxiosResponse => this.#handleResponse(response),
      async (error: AxiosError): Promise<AxiosError> =>
        this.#handleError(error),
    )
  }

  async #handleRequest(
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
    this.#logger(String(new APICallRequestData(config)))
    return config
  }

  #handleResponse(response: AxiosResponse): AxiosResponse {
    this.#logger(String(new APICallResponseData(response)))
    return response
  }

  async #handleError(error: AxiosError): Promise<AxiosError> {
    const apiCallData: APICallContextDataWithErrorMessage =
      createAPICallErrorData(error)
    this.#errorLogger(String(apiCallData))
    switch (error.response?.status) {
      case axios.HttpStatusCode.Unauthorized:
        if (this.#retry && error.config?.url !== LOGIN_URL) {
          this.#handleRetry()
          if ((await this.#loginWithStoredCredentials()) && error.config) {
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

  #handleRetry(): void {
    this.#retry = false
    clearTimeout(this.#retryTimeout)
    this.#retryTimeout = setTimeout(
      () => {
        this.#retry = true
      },
      Duration.fromObject({ minutes: 1 }).as('milliseconds'),
    )
  }

  async #loginWithStoredCredentials(): Promise<boolean> {
    const username = this.#settingManager.get('username')
    const password = this.#settingManager.get('password')
    if (username && password) {
      return (
        (
          await this.login({
            AppVersion: APP_VERSION,
            Email: username,
            Password: password,
            Persist: true,
          })
        ).data.LoginData !== null
      )
    }
    return false
  }
}
