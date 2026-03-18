import type { DeviceType, FacadeManager } from '@olivierzal/melcloud-api'

import type { BuildingZone, Zone } from '../types/index.mts'

const state: { facadeManager?: FacadeManager } = {}

const getFacadeManager = (): FacadeManager => {
  const { facadeManager } = state
  if (!facadeManager) {
    throw new Error('FacadeManager has not been initialized')
  }
  return facadeManager
}

export const setFacadeManager = (value: FacadeManager): void => {
  state.facadeManager = value
}

export const getBuildings = ({
  type,
}: { type?: DeviceType } = {}): BuildingZone[] =>
  getFacadeManager().getBuildings({ type }) as BuildingZone[]

export const getZones = ({ type }: { type?: DeviceType } = {}): Zone[] =>
  getFacadeManager().getZones({ type }) as Zone[]
