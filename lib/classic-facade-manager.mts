import type * as Classic from '@olivierzal/melcloud-api/classic'

const state: { facadeManager?: Classic.FacadeManager } = {}

const getClassicFacadeManager = (): Classic.FacadeManager => {
  const { facadeManager } = state
  if (!facadeManager) {
    throw new Error('Classic.FacadeManager has not been initialized')
  }
  return facadeManager
}

export const setClassicFacadeManager = (value: Classic.FacadeManager): void => {
  state.facadeManager = value
}

export const getClassicBuildings = ({
  type,
}: { type?: Classic.DeviceType } = {}): Classic.BuildingZone[] =>
  getClassicFacadeManager().getBuildings({ type })

export const getClassicZones = ({
  type,
}: { type?: Classic.DeviceType } = {}): Classic.Zone[] =>
  getClassicFacadeManager().getZones({ type })
