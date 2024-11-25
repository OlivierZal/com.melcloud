import {
  BuildingModel,
  type DeviceType,
  type IAreaModel,
  type IDeviceModelAny,
  type IFloorModel,
} from '@olivierzal/melcloud-api'

import type { AreaZone, BuildingZone, FloorZone } from '../types/common.mts'

const hasDevices = (
  zone: { devices: IDeviceModelAny[] },
  type?: DeviceType,
): boolean =>
  type === undefined ?
    Boolean(zone.devices.length)
  : zone.devices.some(({ type: deviceType }) => deviceType === type)

const compareNames = (
  { name: name1 }: { name: string },
  { name: name2 }: { name: string },
): number => name1.localeCompare(name2)

const filterAndMapAreas = (
  areas: IAreaModel[],
  type?: DeviceType,
): AreaZone[] =>
  areas
    .filter((area) => hasDevices(area, type))
    .toSorted(compareNames)
    .map(({ id, name }) => ({ id, name }))

const filterAndMapFloors = (
  floors: IFloorModel[],
  type?: DeviceType,
): FloorZone[] =>
  floors
    .filter((floor) => hasDevices(floor, type))
    .toSorted(compareNames)
    .map(({ areas, id, name }) => ({
      areas: filterAndMapAreas(areas, type),
      id,
      name,
    }))

export const getBuildings = (type?: DeviceType): BuildingZone[] =>
  BuildingModel.getAll()
    .filter((building) => hasDevices(building, type))
    .toSorted(compareNames)
    .map(({ areas, floors, id, name }) => ({
      areas: filterAndMapAreas(
        areas.filter(({ floorId }) => floorId === null),
        type,
      ),
      floors: filterAndMapFloors(floors, type),
      id,
      name,
    }))
