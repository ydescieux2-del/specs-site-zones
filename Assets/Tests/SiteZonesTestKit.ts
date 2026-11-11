/**
 * Shared helpers for the Site Zones LEAF scenarios.
 *
 * The scenarios act the way a person would: they pinch the panels' buttons, pinch
 * the ground, drag markers, and walk and turn the wearer. They read results from
 * the scene and from SiteZonesMain's reports. They never set Lens state directly.
 *
 * "Walking" moves the WearerRig object, which is the parent of the camera. The
 * Lens only ever reads the camera, so to the Lens this is the wearer moving through
 * the site.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {GuideReport, ZoneReport} from "../Scripts/ElectricianGuide"
import {SavedZoneReport, SiteZonesMain} from "../Scripts/SiteZonesMain"
import {GAPS} from "../Scripts/SiteLayout"
import {HazardType} from "../Scripts/ZoneStore"

/** Time for a zone or marker to finish fading in or out. */
export const FADE_MS = 900
/** Time for a pinch to be handled and the scene to settle. */
export const SETTLE_MS = 250

/** Hazard type to the name of its button on the supervisor's panel. */
const TYPE_BUTTON: Record<HazardType, string> = {
  crane: "CraneTypeButton",
  floor: "FloorTypeButton",
}

/**
 * A rectangular outline around floor opening `index`, in site centimeters (x right,
 * z toward the truck), with a margin outside the opening's edge. The default margin
 * clears the striped band painted around each opening in the site model.
 */
export function gapOutline(index: number, marginCm: number = 60): vec2[] {
  const gap = GAPS[index]
  const cx = gap.x * 100
  const cz = -gap.y * 100
  const hx = (gap.w * 100) / 2 + marginCm
  const hz = (gap.d * 100) / 2 + marginCm
  return [new vec2(cx - hx, cz + hz), new vec2(cx + hx, cz + hz), new vec2(cx + hx, cz - hz), new vec2(cx - hx, cz - hz)]
}

/** A LEAF interactor that can also aim a pinch at a chosen point on the ground. */
class SiteInteractor extends DefaultLeafInteractor {
  private aim: vec3 | null = null
  private eye = WorldCameraFinderProvider.getInstance()

  /** Pinches `target` with the ray passing through `worldPoint`. */
  async pinchAt(target: Interactable, worldPoint: vec3): Promise<void> {
    this.aim = worldPoint
    try {
      await this.trigger(target)
    } finally {
      this.aim = null
    }
  }

  // @override: by default LEAF aims at the target's origin. For the ground, aim where asked.
  protected async setTarget(target: Interactable): Promise<void> {
    if (this.aim === null) {
      await super.setTarget(target)
      return
    }
    this.overrideInteractable = target
    this.startPoint = this.eye.getWorldPosition()
    this.endPoint = this.aim
  }
}

export class SiteZonesTestKit {
  readonly main: SiteZonesMain
  private interactor = new SiteInteractor("SiteZonesTestInteractor")
  private siteWorld: SceneObject
  private rig: SceneObject
  private camera = WorldCameraFinderProvider.getInstance()

  constructor() {
    const mainObject = findSceneObjectByName("SiteZones")
    this.main = mainObject.getComponent(SiteZonesMain.getTypeName()) as SiteZonesMain
    this.siteWorld = findSceneObjectByName("SiteWorld")
    this.rig = findSceneObjectByName("WearerRig")
    if (isNull(this.main) || isNull(this.siteWorld) || isNull(this.rig)) {
      throw new Error("Site Zones scene is not set up: SiteZones, SiteWorld or WearerRig is missing.")
    }
  }

  // ---- coordinates --------------------------------------------------------

  /** A point on the site floor, given in site centimeters, as a world position. */
  floor(x: number, z: number): vec3 {
    return this.siteWorld.getTransform().getWorldTransform().multiplyPoint(new vec3(x, 0, z))
  }

  /** A world position as site centimeters. */
  toSite(world: vec3): vec3 {
    return this.siteWorld.getTransform().getInvertedWorldTransform().multiplyPoint(world)
  }

  // ---- the wearer ---------------------------------------------------------

  /**
   * Stands the wearer at site point (x, z) at eye height, looking along the floor
   * direction (headingX, headingZ). Waits a frame so the Lens sees the new pose.
   */
  async standAt(x: number, z: number, headingX: number, headingZ: number): Promise<void> {
    const eyeHeight = -this.siteWorld.getTransform().getLocalPosition().y
    const eye = this.siteWorld.getTransform().getWorldTransform().multiplyPoint(new vec3(x, eyeHeight, z))
    const length = Math.sqrt(headingX * headingX + headingZ * headingZ)
    const heading = new vec3(headingX / length, 0, headingZ / length)

    // The camera looks along its -z axis, so its +z axis has to point away from the heading.
    const wanted = quat.lookAt(heading.uniformScale(-1), vec3.up())
    const cameraTransform = this.camera.getTransform()
    const rigRotation = wanted.multiply(cameraTransform.getLocalRotation().invert())
    const rigPosition = eye.sub(rigRotation.multiplyVec3(cameraTransform.getLocalPosition()))
    this.rig.getTransform().setWorldRotation(rigRotation)
    this.rig.getTransform().setWorldPosition(rigPosition)
    await nextFrame()
    await nextFrame()

    const now = cameraTransform.getWorldPosition()
    expect(now.distance(eye), "the wearer should be standing where the test put him").toBeLessThan(1)
    expect(cameraTransform.back.dot(heading), "the wearer should be looking where the test turned him").toBeGreaterThan(0.99)
  }

  /** Walks in a straight line to (x, z) in steps, keeping the same heading, so the Lens sees a walk and not a jump. */
  async walkTo(x: number, z: number, headingX: number, headingZ: number, stepCm: number = 60): Promise<void> {
    const start = this.toSite(this.camera.getWorldPosition())
    const distance = Math.sqrt((x - start.x) ** 2 + (z - start.z) ** 2)
    const steps = Math.max(1, Math.ceil(distance / stepCm))
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      await this.standAt(start.x + (x - start.x) * t, start.z + (z - start.z) * t, headingX, headingZ)
    }
  }

  // ---- hands --------------------------------------------------------------

  /** Pinches a button by the name of its scene object. */
  async pinch(buttonName: string): Promise<void> {
    const button = findInteractableByName(buttonName)
    if (isNull(button)) {
      throw new Error(`Button "${buttonName}" was not found or is not enabled.`)
    }
    await this.interactor.trigger(button)
    await sleep(SETTLE_MS)
  }

  /** Pinches the ground at site point (x, z). */
  async pinchGround(x: number, z: number): Promise<void> {
    const ground = findInteractableByName("GroundTarget")
    if (isNull(ground)) {
      throw new Error("GroundTarget was not found or is not enabled.")
    }
    await this.interactor.pinchAt(ground, this.floor(x, z))
    await sleep(SETTLE_MS)
  }

  /** Grabs a corner marker and drags it. `perFrame` is how far the hand moves each frame, in world cm. */
  async dragMarker(markerName: string, perFrame: vec3, durationMs: number): Promise<void> {
    const marker = findInteractableByName(markerName)
    if (isNull(marker)) {
      throw new Error(`Marker "${markerName}" was not found or is not enabled.`)
    }
    await this.interactor.drag(marker, perFrame, durationMs)
    await sleep(SETTLE_MS)
  }

  // ---- whole steps --------------------------------------------------------

  /** Switches view by pinching the switch panel, as a person would. */
  async switchTo(role: "supervisor" | "electrician"): Promise<void> {
    await this.pinch(role === "supervisor" ? "SupervisorButton" : "ElectricianButton")
    expect(this.main.role, `the view should now be the ${role}'s`).toBe(role)
  }

  /**
   * As the supervisor: Start Zone, drop a corner at each point, pick the type, Save.
   * Returns the zone that was saved.
   */
  async markZone(type: HazardType, corners: vec2[]): Promise<SavedZoneReport> {
    const before = this.main.savedZones().length
    await this.pinch("StartZoneButton")
    for (const corner of corners) {
      await this.pinchGround(corner.x, corner.y)
    }
    await this.pinch(TYPE_BUTTON[type])
    await this.pinch("SaveButton")
    const saved = this.main.savedZones()
    expect(saved.length - before, "Save should keep exactly one more zone").toBe(1)
    return saved[saved.length - 1]
  }

  /** The electrician's report, which must exist. */
  report(): GuideReport {
    const report = this.main.guideReport()
    if (!report) {
      throw new Error("The electrician's guide has not started.")
    }
    return report
  }

  /** The electrician's view of one zone. */
  zone(id: number): ZoneReport {
    const found = this.report().zones.find((zone) => zone.id === id)
    if (!found) {
      throw new Error(`The electrician's view has no zone ${id}.`)
    }
    return found
  }
}

/** Largest distance between matching corners of two outlines, in cm. */
export function largestCornerGap(a: vec3[], b: vec3[]): number {
  let largest = 0
  for (let i = 0; i < a.length; i++) {
    largest = Math.max(largest, a[i].distance(b[i]))
  }
  return largest
}
