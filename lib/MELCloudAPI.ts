import {
  type APISettings,
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
  type PostData,
  type ReportData,
  type ReportPostData,
  type SuccessData,
} from '../types/MELCloudAPITypes'
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
  get: <K extends keyof APISettings>(
    key: K,
  ) => APISettings[K] | null | undefined
  set: <K extends keyof APISettings>(key: K, value: APISettings[K]) => void
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Logger = (...args: any[]) => void

const LIST_URL = '/User/ListDevices'
const LOGIN_URL = '/Login/ClientLogin'
const MAX_INT32 = 2147483647
const MS_PER_DAY = 86400000
const NO_TIME_DIFF = 0

export default class MELCloudAPI {
  public static readonly instance: MELCloudAPI

  #holdAPIListUntil: DateTime = DateTime.now()

  #loginTimeout!: NodeJS.Timeout

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
    // eslint-disable-next-line no-console
    logger: Logger = console.log,
    errorLogger: Logger = logger,
  ) {
    this.#settingManager = settingManager
    this.#logger = logger
    this.#errorLogger = errorLogger
    this.#api = axios.create({
      baseURL: 'https://app.melcloud.com/Mitsubishi.Wifi.Client',
    })
    this.#setupAxiosInterceptors()
  }

  public static getInstance(
    settingManager?: SettingManager,
    // eslint-disable-next-line no-console
    logger: Logger = console.log,
    errorLogger: Logger = logger,
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
    }
    return response
  }

  public async list(): Promise<{ data: Building[] }> {
    return this.#api.get<Building[]>(LIST_URL)
  }

  public async set<T extends keyof typeof HeatPumpType>(
    heatPumpType: T,
    postData: PostData<T>,
  ): Promise<{ data: DeviceData<T> }> {
    return this.#api.post<DeviceData<T>>(`/Device/Set${heatPumpType}`, postData)
  }

  public async get<T extends keyof typeof HeatPumpType>(
    id: number,
    buildingId: number,
  ): Promise<{ data: DeviceDataFromGet<T> }> {
    return this.#api.get<DeviceDataFromGet<T>>('/Device/Get', {
      params: { buildingId, id },
    })
  }

  public async report<T extends keyof typeof HeatPumpType>(
    postData: ReportPostData,
  ): Promise<{ data: ReportData<T> }> {
    return this.#api.post<ReportData<T>>('/EnergyCost/Report', postData)
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

  public async planRefreshLogin(): Promise<boolean> {
    this.#clearLoginRefresh()
    const expiry: string = this.#settingManager.get('expiry') ?? ''
    const ms: number = DateTime.fromISO(expiry)
      .minus({ days: 1 })
      .diffNow()
      .as('milliseconds')
    if (ms > NO_TIME_DIFF) {
      const interval: number = Math.min(ms, MAX_INT32)
      this.#loginTimeout = setTimeout((): void => {
        this.#attemptAutoLogin().catch((error: Error) => {
          this.#errorLogger(error.message)
        })
      }, interval)
      this.#logger(
        'Login refresh will run in',
        Math.floor(interval / MS_PER_DAY),
      )
      return true
    }
    return this.#attemptAutoLogin()
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
      (response: AxiosResponse): AxiosResponse =>
        this.#handleResponse(response),
      async (error: AxiosError): Promise<AxiosError> =>
        this.#handleError(error),
    )
  }

  async #handleRequest(
    config: InternalAxiosRequestConfig,
  ): Promise<InternalAxiosRequestConfig> {
    const newConfig: InternalAxiosRequestConfig = { ...config }
    if (newConfig.url === LIST_URL && this.#holdAPIListUntil > DateTime.now()) {
      return Promise.reject(
        new Error(
          `API requests to ${LIST_URL} are on hold for ${this.#holdAPIListUntil
            .diffNow()
            .shiftTo('minutes')
            .toHuman()}`,
        ),
      )
    }
    if (newConfig.url !== LOGIN_URL) {
      newConfig.headers.set(
        'X-MitsContextKey',
        this.#settingManager.get('contextKey'),
      )
    }
    this.#logger(String(new APICallRequestData(newConfig)))
    return newConfig
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
          if ((await this.#attemptAutoLogin()) && error.config) {
            return this.#api.request(error.config)
          }
        }
        break
      case axios.HttpStatusCode.TooManyRequests:
        this.#holdAPIListUntil = DateTime.now().plus({ hours: 2 })
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

  async #attemptAutoLogin(): Promise<boolean> {
    const username = this.#settingManager.get('username') ?? ''
    const password = this.#settingManager.get('password') ?? ''
    if (username && password) {
      try {
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
      } catch (error: unknown) {
        // Pass
      }
    }
    return false
  }

  #clearLoginRefresh(): void {
    clearTimeout(this.#loginTimeout)
    this.#logger('Login refresh has been paused')
  }
}
