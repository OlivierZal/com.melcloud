import {
  BuildingModel,
  type DeviceType,
  type IAreaModel,
  type IDeviceModelAny,
  type IFloorModel,
} from '@olivierzal/melcloud-api'

import type { BaseZone, BuildingZone, FloorZone } from '../types/common.mts'

const LEVEL_PREFIX = '···'

const hasDevices = (
  zone: { devices: IDeviceModelAny[] },
  { type }: { type?: DeviceType } = {},
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
  { type }: { type?: DeviceType } = {},
): BaseZone[] =>
  areas
    .filter((area) => hasDevices(area, { type }))
    .toSorted(compareNames)
    .map(({ floor, id, name }) => ({
      id: `areas_${String(id)}`,
      name: `${LEVEL_PREFIX}${floor ? LEVEL_PREFIX : ''} ${name}`,
    }))

const filterAndMapFloors = (
  floors: IFloorModel[],
  { type }: { type?: DeviceType } = {},
): FloorZone[] =>
  floors
    .filter((floor) => hasDevices(floor, { type }))
    .toSorted(compareNames)
    .map(({ areas, id, name }) => ({
      areas: filterAndMapAreas(areas, { type }),
      id: `floors_${String(id)}`,
      name: `${LEVEL_PREFIX} ${name}`,
    }))

export const getBuildings = ({
  type,
}: { type?: DeviceType } = {}): BuildingZone[] =>
  BuildingModel.getAll()
    .filter((building) => hasDevices(building, { type }))
    .toSorted(compareNames)
    .map(({ areas, floors, id, name }) => ({
      areas: filterAndMapAreas(
        areas.filter(({ floorId }) => floorId === null),
        { type },
      ),
      floors: filterAndMapFloors(floors, { type }),
      id: `buildings_${String(id)}`,
      name,
    }))

export const getZones = ({ type }: { type?: DeviceType } = {}): BaseZone[] =>
  getBuildings({ type }).flatMap(({ areas, floors, id, name }) => [
    { id, name },
    ...(areas ?? []),
    ...(floors?.flatMap(
      ({ areas: floorAreas, id: floorId, name: floorName }) => [
        { id: floorId, name: floorName },
        ...(floorAreas ?? []),
      ],
    ) ?? []),
  ])
