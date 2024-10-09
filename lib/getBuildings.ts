import {
  BuildingModel,
  type AreaModelAny,
  type FloorModel,
} from '@olivierzal/melcloud-api'

import type { AreaZone, BuildingZone, FloorZone } from '../types'

const compareNames = (
  { name: name1 }: { name: string },
  { name: name2 }: { name: string },
): number => name1.localeCompare(name2)

const mapArea = ({ id, name }: AreaModelAny): AreaZone => ({ id, name })

const mapFloor = ({ areas, id, name }: FloorModel): FloorZone => ({
  areas: areas.sort(compareNames).map(mapArea),
  id,
  name,
})

const mapBuilding = ({
  areas,
  floors,
  id,
  name,
}: BuildingModel): BuildingZone => ({
  areas: areas
    .filter(({ floorId }: { floorId: number | null }) => floorId === null)
    .sort(compareNames)
    .map(mapArea),
  floors: floors.sort(compareNames).map(mapFloor),
  id,
  name,
})

export const getBuildings = (): BuildingZone[] =>
  BuildingModel.getAll().sort(compareNames).map(mapBuilding)
