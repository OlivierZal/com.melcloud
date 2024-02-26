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
  type LoginCredentials,
  type LoginData,
  type LoginPostData,
  type PostData,
  type ReportData,
  type ReportPostData,
  type SuccessData,
} from './types'
import { DateTime, Duration } from 'luxon'
import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  HttpStatusCode,
  type InternalAxiosRequestConfig,
} from 'axios'
import type { APICallContextDataWithErrorMessage } from './lib/withErrorMessage'
import APICallRequestData from './lib/APICallRequestData'
import APICallResponseData from './lib/APICallResponseData'
import createAPICallErrorData from './lib/APICallErrorData'

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

const throwIfRequested = (error: unknown, raise: boolean): void => {
  if (raise) {
    throw new Error(error instanceof Error ? error.message : String(error))
  }
}

export default class MELCloudAPI {
  #holdAPIListUntil: DateTime = DateTime.now()

  #retry = true

  #retryTimeout!: NodeJS.Timeout

  readonly #api: AxiosInstance

  readonly #errorLogger: Logger

  readonly #logger: Logger

  readonly #settingManager: SettingManager

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

  public async applyLogin(
    { password, username }: LoginCredentials = {
      password: this.#settingManager.get('password') ?? '',
      username: this.#settingManager.get('username') ?? '',
    },
    onSuccess?: () => Promise<void>,
    raise = false,
  ): Promise<boolean> {
    if (username && password) {
      try {
        const { LoginData } = (
          await this.login({
            AppVersion: APP_VERSION,
            Email: username,
            Password: password,
            Persist: true,
          })
        ).data
        if (LoginData !== null && onSuccess) {
          await onSuccess()
        }
        return LoginData !== null
      } catch (error: unknown) {
        throwIfRequested(error, raise)
      }
    }
    return false
  }

  public async errors(
    postData: ErrorLogPostData,
  ): Promise<{ data: ErrorLogData[] | FailureData }> {
    return this.#api.post<ErrorLogData[] | FailureData>(
      '/Report/GetUnitErrorLog2',
      postData,
    )
  }

  public async get<T extends keyof typeof HeatPumpType>(
    id: number,
    buildingId: number,
  ): Promise<{ data: DeviceDataFromGet<T> }> {
    return this.#api.get<DeviceDataFromGet<T>>('/Device/Get', {
      params: { buildingId, id },
    })
  }

  public async getFrostProtection(
    id: number,
  ): Promise<{ data: FrostProtectionData }> {
    return this.#api.get<FrostProtectionData>('/FrostProtection/GetSettings', {
      params: { id, tableName: 'DeviceLocation' },
    })
  }

  public async getHolidayMode(id: number): Promise<{ data: HolidayModeData }> {
    return this.#api.get<HolidayModeData>('/HolidayMode/GetSettings', {
      params: { id, tableName: 'DeviceLocation' },
    })
  }

  public async list(): Promise<{ data: Building[] }> {
    return this.#api.get<Building[]>(LIST_URL)
  }

  public async login(postData: LoginPostData): Promise<{ data: LoginData }> {
    const response: AxiosResponse<LoginData> = await this.#api.post<LoginData>(
      LOGIN_URL,
      postData,
    )
    if (response.data.LoginData) {
      this.#settingManager.set('username', postData.Email)
      this.#settingManager.set('password', postData.Password)
      const { ContextKey: contextKey, Expiry: expiry } = response.data.LoginData
      this.#settingManager.set('contextKey', contextKey)
      this.#settingManager.set('expiry', expiry)
    }
    return response
  }

  public async report<T extends keyof typeof HeatPumpType>(
    postData: ReportPostData,
  ): Promise<{ data: ReportData<T> }> {
    return this.#api.post<ReportData<T>>('/EnergyCost/Report', postData)
  }

  public async set<T extends keyof typeof HeatPumpType>(
    heatPumpType: T,
    postData: PostData<T>,
  ): Promise<{ data: DeviceData<T> }> {
    return this.#api.post<DeviceData<T>>(`/Device/Set${heatPumpType}`, postData)
  }

  public async updateFrostProtection(
    postData: FrostProtectionPostData,
  ): Promise<{ data: FailureData | SuccessData }> {
    return this.#api.post<FailureData | SuccessData>(
      '/FrostProtection/Update',
      postData,
    )
  }

  public async updateHolidayMode(
    postData: HolidayModePostData,
  ): Promise<{ data: FailureData | SuccessData }> {
    return this.#api.post<FailureData | SuccessData>(
      '/HolidayMode/Update',
      postData,
    )
  }

  async #handleError(error: AxiosError): Promise<AxiosError> {
    const apiCallData: APICallContextDataWithErrorMessage =
      createAPICallErrorData(error)
    this.#errorLogger(String(apiCallData))
    switch (error.response?.status) {
      case HttpStatusCode.Unauthorized:
        if (this.#retry && error.config?.url !== LOGIN_URL) {
          this.#handleRetry()
          if ((await this.applyLogin()) && error.config) {
            return this.#api.request(error.config)
          }
        }
        break
      case HttpStatusCode.TooManyRequests:
        this.#holdAPIListUntil = DateTime.now().plus({ hours: 2 })
        break
      default:
    }
    return Promise.reject(error)
  }

  async #handleRequest(
    config: InternalAxiosRequestConfig,
  ): Promise<InternalAxiosRequestConfig> {
    const newConfig: InternalAxiosRequestConfig = { ...config }
    if (newConfig.url === LIST_URL && this.#holdAPIListUntil > DateTime.now()) {
      throw new Error(
        `API requests to ${LIST_URL} are on hold for ${this.#holdAPIListUntil
          .diffNow()
          .shiftTo('minutes')
          .toHuman()}`,
      )
    }
    if (newConfig.url !== LOGIN_URL) {
      const expiry: string = this.#settingManager.get('expiry') ?? ''
      if (expiry && DateTime.fromISO(expiry) < DateTime.now()) {
        await this.applyLogin()
      }
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
}
