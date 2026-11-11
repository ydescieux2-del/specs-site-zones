/**
 * The supervisor's side: start a zone, pinch the ground to drop corner markers,
 * drag markers to adjust, and save. Saved zones go to the shared ZoneStore.
 *
 * Everything is built on SIK Interactables, so it works with hands on the glasses,
 * with the mouse in Interactive Preview, and with LEAF.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {Interactor} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {FlatMesh, makeFlatMaterial, makeVisual} from "./MeshKit"
import {SLAB, slabBounds} from "./SiteLayout"
import {HAZARD_LABEL, HazardType, Zone, ZoneStore} from "./ZoneStore"
import {ZoneVisual} from "./ZoneVisual"

export type SupervisorStatus = {
  /** True between Start Zone and Save. */
  drafting: boolean
  /** The hazard type picked for the zone being drawn, if any. */
  type: HazardType | null
  /** Corners dropped so far in the zone being drawn. */
  corners: number
  /** Zones saved so far. */
  saved: number
  /** One or two short lines telling the supervisor what to do next. */
  message: string
}

type Marker = {
  object: SceneObject
  material: Material
  /** The saved zone this corner belongs to, or null while it is part of the draft. */
  zoneId: number | null
  index: number
  hovered: boolean
  dragOffset: vec3 | null
}

const MIN_CORNERS = 3
const MARKER_RADIUS_CM = 7.5 // about 15 cm across, as in the brief
const MARKER_Y_CM = 3.2
const MARKER_COLOR = new vec4(1.0, 0.95, 0.7, 1)
const MARKER_HOVER_COLOR = new vec4(0.1, 1.0, 0.85, 1)
const MARKER_HOVER_SCALE = 1.45
// The grab target is larger than the disc so it is easy to aim at from standing height.
const MARKER_COLLIDER_CM = new vec3(30, 16, 30)
const GROUND_THICKNESS_CM = 4
const MAX_REACH_CM = 3000

export class SupervisorTool {
  private active = false
  private drafting = false
  private draftType: HazardType | null = null
  private draftPoints: vec3[] = []
  private draftMarkers: Marker[] = []
  private draftVisual: ZoneVisual
  private savedVisuals = new Map<number, ZoneVisual>()
  private savedMarkers = new Map<number, Marker[]>()
  private notice = ""
  private statusChanged = new Event<SupervisorStatus>()
  private markerMesh: FlatMesh
  private groundCollider!: ColliderComponent

  constructor(
    private store: ZoneStore,
    private siteWorld: SceneObject,
    private zonesRoot: SceneObject,
    private markersRoot: SceneObject,
    private groundTarget: SceneObject,
  ) {
    this.draftVisual = new ZoneVisual(this.zonesRoot, "DraftZone")
    this.draftVisual.setLook("draft")

    this.markerMesh = new FlatMesh()
    this.markerMesh.addFloorDisc(MARKER_RADIUS_CM * 0.55, MARKER_Y_CM)
    this.markerMesh.addFloorRing(MARKER_RADIUS_CM * 0.75, MARKER_RADIUS_CM, MARKER_Y_CM)
    this.markerMesh.apply()

    this.buildGroundTarget()
    this.refresh()
  }

  /** Fires whenever the status line or the counts change. */
  get onStatusChanged(): PublicApi<SupervisorStatus> {
    return this.statusChanged.publicApi()
  }

  get status(): SupervisorStatus {
    return {
      drafting: this.drafting,
      type: this.draftType,
      corners: this.draftPoints.length,
      saved: this.store.zones.length,
      message: this.message(),
    }
  }

  /** Corners of the zone being drawn, as the outline is drawing them, in world space. */
  get draftCornersWorld(): vec3[] {
    return this.draftVisual.worldCorners
  }

  /** Shows or hides everything that belongs to the supervisor's view. */
  setActive(active: boolean): void {
    this.active = active
    this.refresh()
  }

  /** Start Zone: begin a new zone. An unsaved draft is dropped. */
  startZone(): void {
    this.discardDraft()
    this.drafting = true
    this.draftType = null
    this.notice = ""
    this.refresh()
  }

  /** Picks the hazard type for the zone being drawn. */
  chooseType(type: HazardType): void {
    if (!this.drafting) {
      this.notice = "Pinch Start Zone first."
      this.refresh()
      return
    }
    this.draftType = type
    this.notice = ""
    this.refresh()
  }

  /** Clear last: removes the most recent corner of the zone being drawn. */
  clearLast(): void {
    if (!this.drafting || this.draftPoints.length === 0) {
      this.notice = this.drafting ? "No corners to clear." : "Pinch Start Zone first."
      this.refresh()
      return
    }
    this.draftPoints.pop()
    const marker = this.draftMarkers.pop()
    if (marker) {
      marker.object.destroy()
    }
    this.notice = ""
    this.refresh()
  }

  /** Save: keeps the zone. Returns false, with a reason in the status, when it cannot be saved yet. */
  save(): boolean {
    if (!this.drafting) {
      this.notice = "Nothing to save. Pinch Start Zone."
      this.refresh()
      return false
    }
    if (this.draftPoints.length < MIN_CORNERS) {
      this.notice = `Drop at least ${MIN_CORNERS} corners before saving.`
      this.refresh()
      return false
    }
    if (this.draftType === null) {
      this.notice = "Pick the hazard type before saving."
      this.refresh()
      return false
    }

    const zone = this.store.add(this.draftType, this.draftPoints)
    const visual = new ZoneVisual(this.zonesRoot, `SavedZone_${zone.id}`)
    visual.setLook("danger")
    visual.setShape(zone.points, true)
    this.savedVisuals.set(zone.id, visual)

    // The draft's markers become the saved zone's markers, so it can still be adjusted.
    this.draftMarkers.forEach((marker, index) => {
      marker.zoneId = zone.id
      marker.index = index
      marker.object.name = markerName(zone.id, index)
    })
    this.savedMarkers.set(zone.id, this.draftMarkers)

    this.draftMarkers = []
    this.draftPoints = []
    this.drafting = false
    this.draftType = null
    this.notice = ""
    this.refresh()
    return true
  }

  // ---- ground and markers -------------------------------------------------

  private buildGroundTarget(): void {
    // One wide, thin collider over the slab. It is only switched on while a zone is
    // being drawn, so it never gets between the supervisor and anything else.
    this.groundCollider = this.groundTarget.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = new vec3((SLAB.x1 - SLAB.x0) * 100, GROUND_THICKNESS_CM, (SLAB.y1 - SLAB.y0) * 100)
    this.groundCollider.shape = shape

    const interactable = this.groundTarget.createComponent(Interactable.getTypeName()) as Interactable
    interactable.onTriggerEnd.add((event) => {
      if (!this.active || !this.drafting) {
        return
      }
      const point = this.groundPoint(event.interactor)
      if (point) {
        this.addCorner(point)
      }
    })
  }

  private addCorner(point: vec3): void {
    const index = this.draftPoints.length
    this.draftPoints.push(point)
    this.draftMarkers.push(this.createMarker(point, null, index))
    this.notice = ""
    this.refresh()
  }

  private createMarker(point: vec3, zoneId: number | null, index: number): Marker {
    const object = global.scene.createSceneObject(markerName(zoneId, index))
    object.setParent(this.markersRoot)
    object.getTransform().setLocalPosition(point)

    const material = makeFlatMaterial(MARKER_COLOR)
    makeVisual(object, "MarkerDisc", this.markerMesh.mesh, material, 3)

    const collider = object.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = MARKER_COLLIDER_CM
    collider.shape = shape

    const marker: Marker = {object, material, zoneId, index, hovered: false, dragOffset: null}

    const interactable = object.createComponent(Interactable.getTypeName()) as Interactable
    interactable.onHoverEnter.add(() => this.setMarkerHover(marker, true))
    interactable.onHoverExit.add(() => this.setMarkerHover(marker, false))
    interactable.onDragStart.add((event) => {
      const hit = this.groundPoint(event.interactor, false)
      const current = object.getTransform().getLocalPosition()
      marker.dragOffset = hit ? new vec3(current.x - hit.x, 0, current.z - hit.z) : vec3.zero()
    })
    interactable.onDragUpdate.add((event) => {
      const hit = this.groundPoint(event.interactor, false)
      if (!hit || !marker.dragOffset) {
        return
      }
      this.moveMarker(marker, clampToSlab(new vec3(hit.x + marker.dragOffset.x, 0, hit.z + marker.dragOffset.z)))
    })
    interactable.onDragEnd.add(() => {
      marker.dragOffset = null
    })
    return marker
  }

  private moveMarker(marker: Marker, point: vec3): void {
    marker.object.getTransform().setLocalPosition(point)
    if (marker.zoneId === null) {
      this.draftPoints[marker.index] = point
      this.redrawDraft()
      return
    }
    this.store.movePoint(marker.zoneId, marker.index, point)
    const zone = this.store.zones.find((candidate: Zone) => candidate.id === marker.zoneId)
    const visual = this.savedVisuals.get(marker.zoneId)
    if (zone && visual) {
      visual.setShape(zone.points, true)
    }
  }

  private setMarkerHover(marker: Marker, hovered: boolean): void {
    marker.hovered = hovered
    const scale = hovered ? MARKER_HOVER_SCALE : 1
    // Scale the disc only, so the grab target stays the same size.
    marker.object.getChild(0).getTransform().setLocalScale(new vec3(scale, 1, scale))
    marker.material.mainPass.baseColor = hovered ? MARKER_HOVER_COLOR : MARKER_COLOR
  }

  /**
   * Where the interactor's ray meets the floor, in the SiteWorld frame. Returns null
   * when the ray does not reach the floor. `mustBeOnSlab` also rejects points off the slab.
   */
  private groundPoint(interactor: Interactor, mustBeOnSlab: boolean = true): vec3 | null {
    const start = interactor.startPoint
    const direction = interactor.direction
    if (!start || !direction) {
      return null
    }
    const toSite = this.siteWorld.getTransform().getInvertedWorldTransform()
    const origin = toSite.multiplyPoint(start)
    const ray = toSite.multiplyDirection(direction)
    if (ray.y > -0.01) {
      return null
    }
    const travel = -origin.y / ray.y
    if (travel <= 0 || travel > MAX_REACH_CM) {
      return null
    }
    const point = new vec3(origin.x + ray.x * travel, 0, origin.z + ray.z * travel)
    if (mustBeOnSlab) {
      const bounds = slabBounds()
      if (point.x < bounds.minX || point.x > bounds.maxX || point.z < bounds.minZ || point.z > bounds.maxZ) {
        return null
      }
    }
    return point
  }

  // ---- drawing and status -------------------------------------------------

  private discardDraft(): void {
    for (const marker of this.draftMarkers) {
      marker.object.destroy()
    }
    this.draftMarkers = []
    this.draftPoints = []
  }

  private redrawDraft(): void {
    this.draftVisual.setShape(this.draftPoints, this.draftPoints.length >= MIN_CORNERS)
  }

  private refresh(): void {
    this.redrawDraft()
    this.zonesRoot.enabled = this.active
    this.markersRoot.enabled = this.active
    this.groundCollider.enabled = this.active && this.drafting
    this.statusChanged.invoke(this.status)
  }

  private message(): string {
    if (this.notice) {
      return this.notice
    }
    const saved = this.store.zones.length
    if (!this.drafting) {
      if (saved === 0) {
        return "Pinch Start Zone to mark a hazard."
      }
      return `${saved} zone${saved === 1 ? "" : "s"} saved. Start Zone adds another.`
    }
    const corners = this.draftPoints.length
    const typeLabel = this.draftType ? HAZARD_LABEL[this.draftType] : "No type yet"
    let next = "Pinch Save to keep it."
    if (corners < MIN_CORNERS) {
      next = "Pinch the ground to drop corners."
    } else if (this.draftType === null) {
      next = "Pick the hazard type."
    }
    return `${typeLabel}: ${corners} corner${corners === 1 ? "" : "s"}. ${next}`
  }
}

function markerName(zoneId: number | null, index: number): string {
  return zoneId === null ? `DraftMarker_${index}` : `Zone${zoneId}Marker_${index}`
}

function clampToSlab(point: vec3): vec3 {
  const bounds = slabBounds()
  return new vec3(
    Math.max(bounds.minX, Math.min(bounds.maxX, point.x)),
    0,
    Math.max(bounds.minZ, Math.min(bounds.maxZ, point.z)),
  )
}
