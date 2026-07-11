import type * as Classic from '@olivierzal/melcloud-api/classic'

const state: { facadeManager?: Classic.FacadeManager } = {}

const getClassicFacadeManager = (): Classic.FacadeManager => {
  const { facadeManager } = state
  if (facadeManager === undefined) {
    throw new Error('Classic.FacadeManager has not been initialized')
  }
  return facadeManager
}

export const setClassicFacadeManager = (value: Classic.FacadeManager): void => {
  state.facadeManager = value
}

export const getClassicBuildings = ({
  type,
}: { type?: Classic.DeviceType | undefined } = {}): Classic.BuildingZone[] =>
  getClassicFacadeManager().getBuildings(type === undefined ? {} : { type })

export const getClassicZones = ({
  type,
}: { type?: Classic.DeviceType | undefined } = {}): Classic.Zone[] =>
  getClassicFacadeManager().getZones(type === undefined ? {} : { type })
