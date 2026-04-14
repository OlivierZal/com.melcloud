import type {
  BuildingZone,
  ClassicFacadeManager,
  DeviceType,
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
}: { type?: DeviceType } = {}): BuildingZone[] =>
  getClassicFacadeManager().getBuildings({ type })

export const getClassicZones = ({ type }: { type?: DeviceType } = {}): Zone[] =>
  getClassicFacadeManager().getZones({ type })
