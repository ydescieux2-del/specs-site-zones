/**
 * The electrician's side: the path from the truck to the work area, zones that
 * appear as he gets close, the Danger sign in each zone, and the beep and arrow
 * when he drifts toward a zone he is not looking at. He gives no hand input.
 *
 * Distances come from the design brief and can be tuned on the SiteZones object.
 */
import {FlatMesh, makeFlatMaterial, makeVisual, withAlpha} from "./MeshKit"
import {pathPoints} from "./SiteLayout"
import {angleToOutline, nearestOnOutline, signedDistance} from "./ZoneMath"
import {HAZARD_LABEL, HazardType, Zone, ZoneStore} from "./ZoneStore"
import {ZoneLook, ZoneVisual} from "./ZoneVisual"

const beepTrack = requireAsset("../GeneratedSFX/WarningBeep.wav") as AudioTrackAsset

export type GuideSettings = {
  /** Zones show when the wearer is this close to their edge (cm). */
  appearDistanceCm: number
  /** Zones turn from yellow to red this close to their edge, or inside (cm). */
  dangerDistanceCm: number
  /** The beep and arrow can start this close to a zone's edge (cm). */
  warnDistanceCm: number
  /** The zone counts as "not looked at" when it is this far from the center of view (degrees). */
  lookAwayDegrees: number
  /** The work area marker shows this close to the end of the path (cm). */
  workAreaDistanceCm: number
  /** Loudness of the warning beep, 0 to 1. */
  beepVolume: number
}

export type ZoneReport = {
  id: number
  type: HazardType
  /** 0 hidden, 1 fully shown. */
  opacity: number
  look: ZoneLook
  /** Distance from the wearer to the zone edge in cm. Negative inside the zone. */
  distanceCm: number
  /** Corners as drawn, in world space. */
  corners: vec3[]
  /** Where the Danger sign stands, in world space. */
  signPosition: vec3
  /** The way the Danger sign faces, in world space. */
  signFacing: vec3
}

export type GuideReport = {
  active: boolean
  pathVisible: boolean
  /** Center of each path chevron as drawn, in world space, in order from the truck. */
  pathChevrons: vec3[]
  workAreaOpacity: number
  /** True while the beep and arrow condition holds. */
  warning: boolean
  /** The zone the warning is about. */
  warningZoneId: number | null
  beeping: boolean
  arrowVisible: boolean
  /** Unit vector in the view plane (x right, y up) that the arrow points along. */
  arrowDirection: vec2
  zones: ZoneReport[]
}

type TrackedZone = {
  zone: Zone
  visual: ZoneVisual
  opacity: number
  shown: boolean
  nearEnough: boolean
  lookedAway: boolean
  distanceCm: number
}

// A light green that reads as "this way" and is not a hazard color.
const PATH_COLOR = new vec4(0.2, 1.0, 0.5, 1)
const PATH_ALPHA = 0.92
const PATH_WIDTH_CM = 40
const PATH_THICKNESS_CM = 11
const PATH_SPACING_CM = 55
const PATH_Y_CM = 2.3

const WORK_COLOR = new vec4(0.2, 1.0, 0.5, 1)
const WORK_WIDTH_CM = 170
const WORK_DEPTH_CM = 130
const WORK_LABEL_Y_CM = 105
const WORK_LABEL_SCALE = 5.2

const FADE_PER_SECOND = 2.6
// Small margins so a zone, or the warning, does not flicker when he stands right on a threshold.
const DISTANCE_SLACK_CM = 20
const ANGLE_SLACK_DEGREES = 3

// The arrow sits about 1 m ahead on an ellipse inside the display's field of view
// (about 32 degrees wide by 37 tall), so it reads as "at the edge of view".
const ARROW_DEPTH_CM = 100
const ARROW_ELLIPSE_X_CM = 19
const ARROW_ELLIPSE_Y_CM = 23
const ARROW_COLOR = new vec4(1.0, 0.03, 0.01, 1)

export class ElectricianGuide {
  private active = false
  private tracked = new Map<number, TrackedZone>()
  private zonesRoot: SceneObject

  private pathObject: SceneObject
  private pathEnd: vec3
  private pathCenters: vec3[] = []

  private workRoot: SceneObject
  private workMaterial: Material
  private workText: Text
  private workOpacity = 0

  private arrow: SceneObject
  private arrowDirection = new vec2(1, 0)
  private audio: AudioComponent
  private beeping = false
  private warning = false
  private warningZoneId: number | null = null

  constructor(
    private store: ZoneStore,
    private siteWorld: SceneObject,
    private siteZones: SceneObject,
    pathAnchor: SceneObject,
    workAnchor: SceneObject,
    cameraObject: SceneObject,
    private settings: GuideSettings,
  ) {
    this.zonesRoot = global.scene.createSceneObject("ElectricianZones")
    this.zonesRoot.setParent(this.siteZones)

    // Path: a line of light chevrons from the truck to the work area.
    const route = pathPoints()
    this.pathEnd = route[route.length - 1]
    const pathMesh = new FlatMesh()
    // Spacing carries over from one leg to the next, so the chevrons stay evenly
    // spaced around the bends.
    let along = PATH_SPACING_CM / 2
    for (let i = 0; i < route.length - 1; i++) {
      const from = route[i]
      const to = route[i + 1]
      const length = from.distance(to)
      const forward = to.sub(from).uniformScale(1 / length)
      for (; along < length; along += PATH_SPACING_CM) {
        const center = from.add(forward.uniformScale(along))
        pathMesh.addFloorChevron(center, forward, PATH_WIDTH_CM, PATH_THICKNESS_CM, PATH_Y_CM)
        this.pathCenters.push(new vec3(center.x, PATH_Y_CM, center.z))
      }
      along -= length
    }
    pathMesh.apply()
    this.pathObject = makeVisual(pathAnchor, "PathChevrons", pathMesh.mesh, makeFlatMaterial(withAlpha(PATH_COLOR, PATH_ALPHA)), 1)

    // Work area: a light outline on the floor and a label above it.
    this.workRoot = global.scene.createSceneObject("WorkAreaMarker")
    this.workRoot.setParent(workAnchor)
    const halfW = WORK_WIDTH_CM / 2
    const halfD = WORK_DEPTH_CM / 2
    const workMesh = new FlatMesh()
    workMesh.addFloorOutline(
      [new vec3(-halfW, 0, -halfD), new vec3(halfW, 0, -halfD), new vec3(halfW, 0, halfD), new vec3(-halfW, 0, halfD)],
      7,
      PATH_Y_CM,
      true,
    )
    workMesh.apply()
    this.workMaterial = makeFlatMaterial(WORK_COLOR)
    makeVisual(this.workRoot, "WorkAreaOutline", workMesh.mesh, this.workMaterial, 1)

    const label = global.scene.createSceneObject("WorkAreaLabel")
    label.setParent(this.workRoot)
    label.getTransform().setLocalPosition(new vec3(0, WORK_LABEL_Y_CM, 0))
    label.getTransform().setLocalScale(new vec3(WORK_LABEL_SCALE, WORK_LABEL_SCALE, WORK_LABEL_SCALE))
    this.workText = label.createComponent("Component.Text") as Text
    this.workText.text = "Your work area"
    this.workText.size = 48
    ;(this.workText as Text & {weight?: number}).weight = 700
    this.workText.depthTest = true
    this.workText.horizontalAlignment = HorizontalAlignment.Center
    this.workText.verticalAlignment = VerticalAlignment.Center
    this.workText.horizontalOverflow = HorizontalOverflow.Overflow
    this.workText.verticalOverflow = VerticalOverflow.Overflow
    this.workText.textFill.color = WORK_COLOR

    // Warning arrow: rides with the wearer's view, about 1 m ahead.
    this.arrow = global.scene.createSceneObject("DangerArrow")
    this.arrow.setParent(cameraObject)
    const arrowMesh = new FlatMesh()
    arrowMesh.addUprightArrow(11, 10, 4)
    arrowMesh.apply()
    const arrowMaterial = makeFlatMaterial(ARROW_COLOR)
    arrowMaterial.mainPass.depthTest = false // never hidden behind site geometry
    makeVisual(this.arrow, "DangerArrowShape", arrowMesh.mesh, arrowMaterial, 20)
    this.arrow.enabled = false

    // Warning beep. Low latency, because it has to land the moment he drifts.
    const audioObject = global.scene.createSceneObject("WarningBeep")
    audioObject.setParent(this.siteZones)
    this.audio = audioObject.createComponent("Component.AudioComponent") as AudioComponent
    this.audio.audioTrack = beepTrack
    this.audio.volume = this.settings.beepVolume
    this.audio.playbackMode = Audio.PlaybackMode.LowLatency

    this.store.onChanged.add(() => this.syncZones())
    this.syncZones()
    this.setActive(false)
  }

  setActive(active: boolean): void {
    this.active = active
    this.pathObject.enabled = active
    this.zonesRoot.enabled = active
    if (!active) {
      this.workOpacity = 0
      this.workRoot.enabled = false
      this.tracked.forEach((entry) => {
        entry.opacity = 0
        entry.shown = false
        entry.nearEnough = false
        entry.lookedAway = false
        entry.visual.setOpacity(0)
      })
      this.setWarning(false, null)
    }
  }

  /**
   * Call once a frame. `eyeWorld` is the wearer's head position, `gazeWorld` the
   * direction he is looking, and `cameraRotation` the head rotation, all in world space.
   */
  update(deltaSeconds: number, eyeWorld: vec3, gazeWorld: vec3, cameraRotation: quat): void {
    if (!this.active) {
      return
    }
    const toSite = this.siteWorld.getTransform().getInvertedWorldTransform()
    const eye = toSite.multiplyPoint(eyeWorld)
    const gaze = toSite.multiplyDirection(gazeWorld)
    const fade = FADE_PER_SECOND * deltaSeconds

    // Work area marker, near the end of the path.
    const toEnd = Math.sqrt((eye.x - this.pathEnd.x) ** 2 + (eye.z - this.pathEnd.z) ** 2)
    this.workOpacity = step(this.workOpacity, toEnd <= this.settings.workAreaDistanceCm ? 1 : 0, fade)
    this.workRoot.enabled = this.workOpacity > 0.01
    if (this.workRoot.enabled) {
      this.workMaterial.mainPass.baseColor = withAlpha(WORK_COLOR, 0.95 * this.workOpacity)
      this.workText.textFill.color = withAlpha(WORK_COLOR, this.workOpacity)
      const anchor = this.workRoot.getParent().getTransform().getLocalPosition()
      this.workText
        .getSceneObject()
        .getTransform()
        .setLocalRotation(quat.fromEulerAngles(0, Math.atan2(eye.x - anchor.x, eye.z - anchor.z), 0))
    }

    // Zones.
    let warnEntry: TrackedZone | null = null
    this.tracked.forEach((entry) => {
      const points = entry.zone.points
      const distance = signedDistance(eye, points)
      entry.distanceCm = distance
      const inside = distance < 0

      entry.shown = withSlack(entry.shown, distance, this.settings.appearDistanceCm, DISTANCE_SLACK_CM)
      entry.opacity = step(entry.opacity, entry.shown ? 1 : 0, fade)
      entry.visual.setOpacity(entry.opacity)
      entry.visual.setLook(distance <= this.settings.dangerDistanceCm ? "danger" : "caution")
      if (entry.opacity > 0.01) {
        entry.visual.placeSign(eye)
      }

      entry.nearEnough = withSlack(entry.nearEnough, distance, this.settings.warnDistanceCm, DISTANCE_SLACK_CM)
      if (inside) {
        entry.lookedAway = false
      } else {
        const angle = angleToOutline(eye, gaze, points)
        const limit = this.settings.lookAwayDegrees - (entry.lookedAway ? ANGLE_SLACK_DEGREES : 0)
        entry.lookedAway = angle > limit
      }

      const warns = inside || (entry.nearEnough && entry.lookedAway)
      if (warns && (warnEntry === null || distance < warnEntry.distanceCm)) {
        warnEntry = entry
      }
    })

    const chosen = warnEntry as TrackedZone | null
    this.setWarning(chosen !== null, chosen ? chosen.zone.id : null)

    // The arrow shows which way the danger is. Inside a zone there is no single
    // direction to point, so only the beep repeats until he steps out.
    const showArrow = chosen !== null && chosen.distanceCm >= 0
    this.arrow.enabled = showArrow
    if (showArrow && chosen) {
      const nearest = nearestOnOutline(eye, chosen.zone.points).point
      const targetWorld = this.siteWorld.getTransform().getWorldTransform().multiplyPoint(nearest)
      // Aim at the nearest edge at head height, so the arrow shows left or right, not just "down".
      const toward = new vec3(targetWorld.x - eyeWorld.x, 0, targetWorld.z - eyeWorld.z)
      const local = cameraRotation.invert().multiplyVec3(toward)
      let x = local.x
      let y = local.y
      const length = Math.sqrt(x * x + y * y)
      if (length < 1e-3) {
        x = 1
        y = 0
      } else {
        x /= length
        y /= length
      }
      this.arrowDirection = new vec2(x, y)
      const pulse = 1 + 0.12 * Math.sin(getTime() * 9)
      const transform = this.arrow.getTransform()
      transform.setLocalPosition(new vec3(x * ARROW_ELLIPSE_X_CM, y * ARROW_ELLIPSE_Y_CM, -ARROW_DEPTH_CM))
      // The arrow mesh points along +y; turn it to point along (x, y).
      transform.setLocalRotation(quat.fromEulerAngles(0, 0, Math.atan2(y, x) - Math.PI / 2))
      transform.setLocalScale(new vec3(pulse, pulse, pulse))
    }
  }

  /** A snapshot of what the electrician is being shown right now. */
  report(): GuideReport {
    const zones: ZoneReport[] = []
    this.tracked.forEach((entry) => {
      const sign = entry.visual.signObject
      const signTransform = sign ? sign.getTransform() : entry.visual.root.getTransform()
      zones.push({
        id: entry.zone.id,
        type: entry.zone.type,
        opacity: entry.opacity,
        look: entry.visual.currentLook,
        distanceCm: entry.distanceCm,
        corners: entry.visual.worldCorners,
        signPosition: signTransform.getWorldPosition(),
        signFacing: signTransform.forward,
      })
    })
    const pathToWorld = this.pathObject.getTransform().getWorldTransform()
    return {
      active: this.active,
      pathVisible: this.pathObject.enabled,
      pathChevrons: this.pathCenters.map((center) => pathToWorld.multiplyPoint(center)),
      workAreaOpacity: this.workOpacity,
      warning: this.warning,
      warningZoneId: this.warningZoneId,
      beeping: this.beeping,
      arrowVisible: this.arrow.enabled,
      arrowDirection: this.arrowDirection,
      zones,
    }
  }

  private syncZones(): void {
    for (const zone of this.store.zones) {
      let entry = this.tracked.get(zone.id)
      if (!entry) {
        const visual = new ZoneVisual(this.zonesRoot, `ElectricianZone_${zone.id}`)
        visual.setLook("caution")
        visual.addSign(HAZARD_LABEL[zone.type])
        visual.setOpacity(0)
        entry = {zone, visual, opacity: 0, shown: false, nearEnough: false, lookedAway: false, distanceCm: Number.MAX_VALUE}
        this.tracked.set(zone.id, entry)
      }
      entry.zone = zone
      entry.visual.setShape(zone.points, true)
    }
  }

  private setWarning(warning: boolean, zoneId: number | null): void {
    this.warning = warning
    this.warningZoneId = zoneId
    if (warning && !this.beeping) {
      this.audio.play(-1) // loop until the warning ends
      this.beeping = true
    } else if (!warning && this.beeping) {
      this.audio.stop(false)
      this.beeping = false
    }
    if (!warning) {
      this.arrow.enabled = false
    }
  }
}

/** Moves `value` toward `target` by at most `amount`. */
function step(value: number, target: number, amount: number): number {
  if (value < target) {
    return Math.min(target, value + amount)
  }
  return Math.max(target, value - amount)
}

/** True when within `limit`; once true, stays true until `limit + slack` is passed. */
function withSlack(current: boolean, distance: number, limit: number, slack: number): boolean {
  return distance <= (current ? limit + slack : limit)
}
