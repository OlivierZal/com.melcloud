import {
  APICallRequestData,
  APICallResponseData,
  APP_VERSION,
  type Building,
  type DeviceData,
  type DeviceDataFromGet,
  type DeviceType,
  type ErrorLogData,
  type ErrorLogPostData,
  type FailureData,
  type FrostProtectionData,
  type FrostProtectionPostData,
  type HolidayModeData,
  type HolidayModePostData,
  type LoginCredentials,
  type LoginData,
  type LoginPostData,
  type PostData,
  type ReportData,
  type ReportPostData,
  type SuccessData,
  createAPICallErrorData,
} from '..'
import {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  HttpStatusCode,
  type InternalAxiosRequestConfig,
  create as createAxiosInstance,
} from 'axios'
import { DateTime, Duration } from 'luxon'

interface APISettings {
  readonly contextKey?: string | null
  readonly expiry?: string | null
  readonly password?: string | null
  readonly username?: string | null
}

interface Logger {
  readonly error: Console['error']
  readonly log: Console['log']
}

interface SettingManager {
  get: <K extends keyof APISettings>(
    key: K,
  ) => APISettings[K] | null | undefined
  set: <K extends keyof APISettings>(key: K, value: APISettings[K]) => void
}

const LIST_URL = '/User/ListDevices'
const LOGIN_URL = '/Login/ClientLogin'

export default class MELCloudAPI {
  #holdAPIListUntil = DateTime.now()

  #retry = true

  #retryTimeout!: NodeJS.Timeout

  readonly #api: AxiosInstance

  readonly #logger: Logger

  readonly #settingManager: SettingManager

  public constructor(settingManager: SettingManager, logger: Logger = console) {
    this.#settingManager = settingManager
    this.#logger = logger
    this.#api = createAxiosInstance({
      baseURL: 'https://app.melcloud.com/Mitsubishi.Wifi.Client',
    })
    this.#setupAxiosInterceptors()
  }

  public async applyLogin(
    data?: LoginCredentials,
    onSuccess?: () => Promise<void>,
  ): Promise<boolean> {
    const { password, username } = data ?? {
      password: this.#settingManager.get('password') ?? '',
      username: this.#settingManager.get('username') ?? '',
    }
    if (username && password) {
      try {
        const { LoginData: loginData } = (
          await this.login({
            AppVersion: APP_VERSION,
            Email: username,
            Password: password,
            Persist: true,
          })
        ).data
        if (loginData) {
          await onSuccess?.()
        }
        return loginData !== null
      } catch (error) {
        if (typeof data !== 'undefined') {
          throw error
        }
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

  public async get<T extends keyof typeof DeviceType>(
    id: number,
    buildingId: number,
  ): Promise<{ data: DeviceDataFromGet[T] }> {
    return this.#api.get<DeviceDataFromGet[T]>('/Device/Get', {
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
    const response = await this.#api.post<LoginData>(LOGIN_URL, postData)
    if (response.data.LoginData) {
      this.#settingManager.set('username', postData.Email)
      this.#settingManager.set('password', postData.Password)
      this.#settingManager.set('contextKey', response.data.LoginData.ContextKey)
      this.#settingManager.set('expiry', response.data.LoginData.Expiry)
    }
    return response
  }

  public async report<T extends keyof typeof DeviceType>(
    postData: ReportPostData,
  ): Promise<{ data: ReportData[T] }> {
    return this.#api.post<ReportData[T]>('/EnergyCost/Report', postData)
  }

  public async set<T extends keyof typeof DeviceType>(
    heatPumpType: T,
    postData: PostData[T],
  ): Promise<{ data: DeviceData[T] }> {
    return this.#api.post<DeviceData[T]>(`/Device/Set${heatPumpType}`, postData)
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
    const errorData = createAPICallErrorData(error)
    this.#logger.error(String(errorData))
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
    throw new Error(errorData.errorMessage)
  }

  async #handleRequest(
    config: InternalAxiosRequestConfig,
  ): Promise<InternalAxiosRequestConfig> {
    const newConfig = { ...config }
    if (newConfig.url === LIST_URL && this.#holdAPIListUntil > DateTime.now()) {
      throw new Error(
        `API requests to ${LIST_URL} are on hold for ${this.#holdAPIListUntil
          .diffNow()
          .shiftTo('minutes')
          .toHuman()}`,
      )
    }
    if (newConfig.url !== LOGIN_URL) {
      const expiry = this.#settingManager.get('expiry') ?? ''
      if (expiry && DateTime.fromISO(expiry) < DateTime.now()) {
        await this.applyLogin()
      }
      newConfig.headers.set(
        'X-MitsContextKey',
        this.#settingManager.get('contextKey'),
      )
    }
    this.#logger.log(String(new APICallRequestData(newConfig)))
    return newConfig
  }

  #handleResponse(response: AxiosResponse): AxiosResponse {
    this.#logger.log(String(new APICallResponseData(response)))
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
