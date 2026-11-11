/**
 * The zones the supervisor has saved. One store is shared by the supervisor's tool
 * and the electrician's guide, which is what stands in for zones being shared
 * between two pairs of glasses. Zones live in memory only and are gone when the
 * Lens closes.
 *
 * Points are in the SiteWorld frame (centimeters, y = 0 on the floor).
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"

export type HazardType = "crane" | "floor"

/** The short line shown under DANGER for each hazard type. */
export const HAZARD_LABEL: Record<HazardType, string> = {
  crane: "Crane swing area",
  floor: "Floor opening",
}

export type Zone = {
  id: number
  type: HazardType
  points: vec3[]
}

export class ZoneStore {
  private zoneList: Zone[] = []
  private nextId = 1
  private changed = new Event<void>()

  /** Fires after a zone is added or reshaped. */
  get onChanged(): PublicApi<void> {
    return this.changed.publicApi()
  }

  get zones(): Zone[] {
    return this.zoneList
  }

  add(type: HazardType, points: vec3[]): Zone {
    const zone: Zone = {
      id: this.nextId++,
      type,
      points: points.map((point) => new vec3(point.x, 0, point.z)),
    }
    this.zoneList.push(zone)
    this.changed.invoke()
    return zone
  }

  movePoint(zoneId: number, index: number, point: vec3): void {
    const zone = this.zoneList.find((candidate) => candidate.id === zoneId)
    if (!zone || index < 0 || index >= zone.points.length) {
      return
    }
    zone.points[index] = new vec3(point.x, 0, point.z)
    this.changed.invoke()
  }
}
