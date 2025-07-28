import {
  type DeviceType,
  type IAreaModel,
  type IDeviceModelAny,
  type IFloorModel,
  BuildingModel,
} from '@olivierzal/melcloud-api'

import type {
  AreaZone,
  BuildingZone,
  DeviceZone,
  FloorZone,
  Zone,
} from '../types/common.mts'

const LEVEL_1 = 1
const LEVEL_2 = 2
const LEVEL_3 = 3

const hasDevices = (
  zone: { devices: IDeviceModelAny[] },
  { type }: { type?: DeviceType } = {},
): boolean =>
  type === undefined ?
    zone.devices.length > 0
  : zone.devices.some(({ type: deviceType }) => deviceType === type)

const compareNames = (
  { name: name1 }: { name: string },
  { name: name2 }: { name: string },
): number => name1.localeCompare(name2)

const getDeviceLevel = ({
  area,
  floor,
}: {
  area?: IAreaModel | null
  floor?: IFloorModel | null
}): number => {
  if (area && floor) {
    return LEVEL_3
  }
  return area || floor ? LEVEL_2 : LEVEL_1
}

const filterAndMapDevices = (
  devices: IDeviceModelAny[],
  { type }: { type?: DeviceType } = {},
): DeviceZone[] =>
  (type === undefined ? devices : (
    devices.filter(({ type: deviceType }) => deviceType === type)
  )
  )
    .map(({ area, floor, id, name }) => ({
      id,
      level: getDeviceLevel({ area, floor }),
      model: 'devices' as const,
      name,
    }))
    .toSorted(compareNames)

const filterAndMapAreas = (
  areas: IAreaModel[],
  { type }: { type?: DeviceType } = {},
): AreaZone[] =>
  areas
    .filter((area) => hasDevices(area, { type }))
    .map(({ devices, floor, id, name }) => ({
      devices: filterAndMapDevices(devices, { type }),
      id,
      level: floor ? LEVEL_2 : LEVEL_1,
      model: 'areas' as const,
      name,
    }))
    .toSorted(compareNames)

const filterAndMapFloors = (
  floors: IFloorModel[],
  { type }: { type?: DeviceType } = {},
): FloorZone[] =>
  floors
    .filter((floor) => hasDevices(floor, { type }))
    .map(({ areas, devices, id, name }) => ({
      areas: filterAndMapAreas(areas, { type }),
      devices: filterAndMapDevices(
        devices.filter(({ areaId }) => areaId === null),
        { type },
      ),
      id,
      level: 1,
      model: 'floors' as const,
      name,
    }))
    .toSorted(compareNames)

export const getBuildings = ({
  type,
}: { type?: DeviceType } = {}): BuildingZone[] =>
  BuildingModel.getAll()
    .filter((building) => hasDevices(building, { type }))
    .map(({ areas, devices, floors, id, name }) => ({
      areas: filterAndMapAreas(
        areas.filter(({ floorId }) => floorId === null),
        { type },
      ),
      devices: filterAndMapDevices(
        devices.filter(
          ({ areaId, floorId }) => areaId === null && floorId === null,
        ),
        { type },
      ),
      floors: filterAndMapFloors(floors, { type }),
      id,
      level: 0,
      model: 'buildings' as const,
      name,
    }))
    .toSorted(compareNames)

export const getZones = ({ type }: { type?: DeviceType } = {}): Zone[] =>
  getBuildings({ type })
    .flatMap(({ areas, devices, floors, ...building }) => [
      building,
      ...(devices ?? []),
      ...(areas ?? []),
      ...(floors?.flatMap(
        ({ areas: floorAreas, devices: floorDevices, ...floor }) => [
          floor,
          ...(floorDevices ?? []),
          ...(floorAreas?.flatMap(
            ({ devices: floorAreaDevices, ...floorArea }) => [
              floorArea,
              ...(floorAreaDevices ?? []),
            ],
          ) ?? []),
        ],
      ) ?? []),
    ])
    .toSorted(compareNames)
