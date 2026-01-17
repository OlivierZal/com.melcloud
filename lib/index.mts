export { getBuildings, getZones } from './get-zones.mts'
export { isTotalEnergyKey } from './is-total-energy-key.mts'
export {
  type SmartFanConfig,
  type SmartFanMode,
  type SmartFanState,
  calculateOptimalFanSpeed,
  clearManualOverride,
  createSmartFanState,
  DEFAULT_SMART_FAN_CONFIG,
  getRemainingPauseMinutes,
  isManualOverrideActive,
  setManualOverride,
  updateSmartFanState,
} from './smart-fan-controller.mts'
