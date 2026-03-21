import type HomeyWidget from 'homey/lib/HomeyWidget'

import type { HomeyWidgetSettingsAtaGroupSetting as HomeySettings } from '../../../types/index.mts'

export declare interface Homey extends HomeyWidget {
  readonly getSettings: () => HomeySettings
}
