import { DateTime } from 'luxon'
import { OperationModeZoneAtw } from './types'

// eslint-disable-next-line @typescript-eslint/no-magic-numbers
export const MAX_INT32: number = 2 ** 31 - 1

export const EMPTY_FUNCTION_PARENS = '()'
export const GAP_2 = 2
export const HTTP_STATUS_UNAUTHORIZED = 401
export const K_MULTIPLIER = 1000
export const YEAR_1 = 1
const YEAR_1970 = 1970
export const ZONE_1 = 1
export const ZONE_2 = 2

export const DATETIME_1970: DateTime = DateTime.local(YEAR_1970)

export const ATW_ROOM_VALUE: number = OperationModeZoneAtw.room
const ATW_ROOM_COOL_VALUE: number = OperationModeZoneAtw.room_cool
export const ATW_ROOM_VALUES: number[] = [ATW_ROOM_VALUE, ATW_ROOM_COOL_VALUE]
export const ATW_CURVE_VALUE: number = OperationModeZoneAtw.curve
export const ATW_ROOM_FLOW_GAP: number = OperationModeZoneAtw.flow
export const ATW_HEAT_COOL_GAP: number = ATW_ROOM_COOL_VALUE
