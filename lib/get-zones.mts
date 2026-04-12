import type {
  BuildingZone,
  ClassicFacadeManager,
  DeviceType,
  Zone,
} from '@olivierzal/melcloud-api'

const state: { facadeManager?: ClassicFacadeManager } = {}

const getFacadeManager = (): ClassicFacadeManager => {
  const { facadeManager } = state
  if (!facadeManager) {
    throw new Error('FacadeManager has not been initialized')
  }
  return facadeManager
}

export const setFacadeManager = (value: ClassicFacadeManager): void => {
  state.facadeManager = value
}

export const getBuildings = ({
  type,
}: { type?: DeviceType } = {}): BuildingZone[] =>
  getFacadeManager().getBuildings({ type })

export const getZones = ({ type }: { type?: DeviceType } = {}): Zone[] =>
  getFacadeManager().getZones({ type })
