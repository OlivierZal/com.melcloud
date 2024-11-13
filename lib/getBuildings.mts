import {
  BuildingModel,
  type IAreaModel,
  type IDeviceModelAny,
  type IFloorModel,
} from '@olivierzal/melcloud-api'

import type { AreaZone, BuildingZone, FloorZone } from '../types/index.mjs'

const hasDevices = (zone: { devices: IDeviceModelAny[] }): boolean =>
  Boolean(zone.devices.length)

const compareNames = (
  { name: name1 }: { name: string },
  { name: name2 }: { name: string },
): number => name1.localeCompare(name2)

const filterAndMapAreas = (areas: IAreaModel[]): AreaZone[] =>
  areas
    .filter(hasDevices)
    .toSorted(compareNames)
    .map(({ id, name }) => ({ id, name }))

const filterAndMapFloors = (floors: IFloorModel[]): FloorZone[] =>
  floors
    .filter(hasDevices)
    .toSorted(compareNames)
    .map(({ areas, id, name }) => ({
      areas: filterAndMapAreas(areas),
      id,
      name,
    }))

export const getBuildings = (): BuildingZone[] =>
  BuildingModel.getAll()
    .filter(hasDevices)
    .toSorted(compareNames)
    .map(({ areas, floors, id, name }) => ({
      areas: filterAndMapAreas(areas.filter(({ floorId }) => floorId === null)),
      floors: filterAndMapFloors(floors),
      id,
      name,
    }))
