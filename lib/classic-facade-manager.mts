import type {
  BuildingZone,
  ClassicDeviceType,
  ClassicFacadeManager,
  Zone,
} from '@olivierzal/melcloud-api'

const state: { facadeManager?: ClassicFacadeManager } = {}

const getClassicFacadeManager = (): ClassicFacadeManager => {
  const { facadeManager } = state
  if (!facadeManager) {
    throw new Error('FacadeManager has not been initialized')
  }
  return facadeManager
}

export const setClassicFacadeManager = (value: ClassicFacadeManager): void => {
  state.facadeManager = value
}

export const getClassicBuildings = ({
  type,
}: { type?: ClassicDeviceType } = {}): BuildingZone[] =>
  getClassicFacadeManager().getBuildings({ type })

export const getClassicZones = ({
  type,
}: { type?: ClassicDeviceType } = {}): Zone[] =>
  getClassicFacadeManager().getZones({ type })
