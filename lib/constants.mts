import type { Api } from '../types/api.mts'

// The user-facing service names: the sign-in failure alerts and the
// per-account log lines both say WHICH account they speak of.
export const API_DISPLAY_NAMES: Readonly<Record<Api, string>> = {
  classic: 'MELCloud Classic',
  home: 'MELCloud Home',
}

// SI kilo prefix ratio, shared by the W <-> kW and Wh <-> kWh
// conversions alike.
export const KILO = 1000

// The account a dialect does NOT pair from: when a driver's own
// credentials are refused, that account's listing says where the units
// are.
export const OTHER_API: Readonly<Record<Api, Api>> = {
  classic: 'home',
  home: 'classic',
}

// Tabular missing-value marker (language-neutral, unlike an N/A) for a
// wire stamp that carries no instant (`null` epoch reads from the
// library); the row or capability itself is kept — the fact is real
// even without its moment.
export const UNKNOWN_DATE_PLACEHOLDER = '—'
