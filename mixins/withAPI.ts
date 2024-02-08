import type {
  Building,
  ErrorLogData,
  ErrorLogPostData,
  FLAG_UNCHANGED,
  FailureData,
  FrostProtectionData,
  FrostProtectionPostData,
  GetDeviceData,
  HeatPumpType,
  HolidayModeData,
  HolidayModePostData,
  HomeyClass,
  HomeySettings,
  LoginData,
  LoginPostData,
  MELCloudDriver,
  PostData,
  ReportData,
  ReportPostData,
  SuccessData,
} from '../types'
import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import type { APICallContextDataWithErrorMessage } from './withErrorMessage'
import APICallRequestData from '../lib/APICallRequestData'
import APICallResponseData from '../lib/APICallResponseData'
import { DateTime } from 'luxon'
import type MELCloudApp from '../app'
import createAPICallErrorData from '../lib/APICallErrorData'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type APIClass = new (...args: any[]) => {
  readonly api: AxiosInstance
  readonly apiError: (
    postData: ErrorLogPostData,
  ) => Promise<{ data: ErrorLogData[] | FailureData }>
  readonly apiGet: <D extends MELCloudDriver>(
    id: string,
    buildingId: string,
  ) => Promise<{
    data: GetDeviceData<D> & { readonly EffectiveFlags: typeof FLAG_UNCHANGED }
  }>
  readonly apiGetFrostProtection: (
    id: number,
  ) => Promise<{ data: FrostProtectionData }>
  readonly apiGetHolidayMode: (id: number) => Promise<{ data: HolidayModeData }>
  readonly apiUpdateFrostProtection: (
    postData: FrostProtectionPostData,
  ) => Promise<{ data: FailureData | SuccessData }>
  readonly apiUpdateHolidayMode: (
    postData: HolidayModePostData,
  ) => Promise<{ data: FailureData | SuccessData }>
  readonly apiList: () => Promise<{ data: Building[] }>
  readonly apiLogin: (postData: LoginPostData) => Promise<{ data: LoginData }>
  readonly apiReport: <D extends MELCloudDriver>(
    postData: ReportPostData,
  ) => Promise<{ data: ReportData<D> }>
  readonly apiSet: <D extends MELCloudDriver>(
    heatPumpType: keyof typeof HeatPumpType,
    postData: PostData<D>,
  ) => Promise<{ data: GetDeviceData<D> }>
  readonly getHomeySetting: <K extends keyof HomeySettings>(
    setting: K,
  ) => HomeySettings[K]
}

const LIST_URL = '/User/ListDevices'
const LOGIN_URL = '/Login/ClientLogin'

// eslint-disable-next-line max-lines-per-function
const withAPI = <T extends HomeyClass>(base: T): APIClass & T =>
  class WithAPI extends base {
    public readonly api: AxiosInstance = axios.create()

    public readonly app: MELCloudApp = this.homey.app as MELCloudApp

    #holdAPIListUntil: DateTime = DateTime.now()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public constructor(...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      super(...args)
      this.setupAxiosInterceptors()
    }

    public getHomeySetting<K extends keyof HomeySettings>(
      setting: K,
    ): HomeySettings[K] {
      return this.homey.settings.get(setting) as HomeySettings[K]
    }

    public async apiLogin(
      postData: LoginPostData,
    ): Promise<{ data: LoginData }> {
      return this.api.post<LoginData>(LOGIN_URL, postData)
    }

    public async apiList(): Promise<{ data: Building[] }> {
      return this.api.get<Building[]>(LIST_URL)
    }

    public async apiSet<D extends MELCloudDriver>(
      heatPumpType: keyof typeof HeatPumpType,
      postData: PostData<D>,
    ): Promise<{ data: GetDeviceData<D> }> {
      return this.api.post<GetDeviceData<D>>(
        `/Device/Set${heatPumpType}`,
        postData,
      )
    }

    public async apiGet<D extends MELCloudDriver>(
      id: string,
      buildingId: string,
    ): Promise<{
      data: GetDeviceData<D> & {
        readonly EffectiveFlags: typeof FLAG_UNCHANGED
      }
    }> {
      return this.api.get<
        GetDeviceData<D> & { readonly EffectiveFlags: typeof FLAG_UNCHANGED }
      >('/Device/Get', { params: { buildingId, id } })
    }

    public async apiReport<D extends MELCloudDriver>(
      postData: ReportPostData,
    ): Promise<{ data: ReportData<D> }> {
      return this.api.post<ReportData<D>>('/EnergyCost/Report', postData)
    }

    public async apiError(
      postData: ErrorLogPostData,
    ): Promise<{ data: ErrorLogData[] | FailureData }> {
      return this.api.post<ErrorLogData[] | FailureData>(
        '/Report/GetUnitErrorLog2',
        postData,
      )
    }

    public async apiGetFrostProtection(
      id: number,
    ): Promise<{ data: FrostProtectionData }> {
      return this.api.get<FrostProtectionData>('/FrostProtection/GetSettings', {
        params: { id, tableName: 'DeviceLocation' },
      })
    }

    public async apiUpdateFrostProtection(
      postData: FrostProtectionPostData,
    ): Promise<{ data: FailureData | SuccessData }> {
      return this.api.post<FailureData | SuccessData>(
        '/FrostProtection/Update',
        postData,
      )
    }

    public async apiGetHolidayMode(
      id: number,
    ): Promise<{ data: HolidayModeData }> {
      return this.api.get<HolidayModeData>('/HolidayMode/GetSettings', {
        params: { id, tableName: 'DeviceLocation' },
      })
    }

    public async apiUpdateHolidayMode(
      postData: HolidayModePostData,
    ): Promise<{ data: FailureData | SuccessData }> {
      return this.api.post<FailureData | SuccessData>(
        '/HolidayMode/Update',
        postData,
      )
    }

    private setupAxiosInterceptors(): void {
      this.api.interceptors.request.use(
        async (
          config: InternalAxiosRequestConfig,
        ): Promise<InternalAxiosRequestConfig> => this.handleRequest(config),
        async (error: AxiosError): Promise<AxiosError> =>
          this.handleError(error),
      )
      this.api.interceptors.response.use(
        (response: AxiosResponse): AxiosResponse =>
          this.handleResponse(response),
        async (error: AxiosError): Promise<AxiosError> =>
          this.handleError(error),
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
      const updatedConfig: InternalAxiosRequestConfig = { ...config }
      updatedConfig.headers.set(
        'X-MitsContextKey',
        this.getHomeySetting('contextKey'),
      )
      this.log(String(new APICallRequestData(updatedConfig)))
      return updatedConfig
    }

    private handleResponse(response: AxiosResponse): AxiosResponse {
      this.log(String(new APICallResponseData(response)))
      return response
    }

    private async handleError(error: AxiosError): Promise<AxiosError> {
      const apiCallData: APICallContextDataWithErrorMessage =
        createAPICallErrorData(error)
      this.error(String(apiCallData))
      switch (error.response?.status) {
        case axios.HttpStatusCode.Unauthorized:
          if (this.app.retry && error.config?.url !== LOGIN_URL) {
            this.app.handleRetry()
            if ((await this.app.login()) && error.config) {
              return this.api.request(error.config)
            }
          }
          break
        case axios.HttpStatusCode.TooManyRequests:
          this.#holdAPIListUntil = DateTime.now().plus({ minutes: 30 })
          break
        default:
      }
      await this.setErrorWarning(apiCallData.errorMessage)
      return Promise.reject(error)
    }

    private async setErrorWarning(warning: string | null): Promise<void> {
      if (this.setWarning) {
        await this.setWarning(warning)
      }
    }
  }

export default withAPI
