/**
 * Not a test. A guided tour to watch (or record) in the preview: it plays the whole
 * flow at walking pace, moving the wearer smoothly.
 *
 *   1. Supervisor: marks both floor openings and the crane's swing area.
 *   2. Electrician: follows the path, drifts toward a floor opening while looking
 *      ahead (beep and arrow), looks at it (they stop), steps back onto the path,
 *      and walks on to the work area.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {findSceneObjectByName, nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CRANE} from "../Scripts/SiteLayout"
import {HazardType} from "../Scripts/ZoneStore"
import {gapOutline, SiteZonesTestKit} from "./SiteZonesTestKit"

const WALK_CM_PER_S = 130
const TURN_S = 0.7
/** Tilt that centers the supervisor's panel, which floats just below eye level. */
const PANEL_PITCH = 0.13
/** Steepest downward look while dropping corners, so the view keeps the site in frame, not only floor. */
const MAX_FLOOR_PITCH = 0.44

@component
export class GuidedTourScenario extends Scenario {
  private kit!: SiteZonesTestKit
  private rig!: Transform
  private camera!: Transform
  private siteWorld!: Transform
  private x = 0
  private z = 0
  private yaw = 0 // radians; 0 faces away from the truck, positive turns right
  private pitch = 0 // radians; positive looks down
  private beeping = false
  private tourStart = 0

  async run(): Promise<void> {
    await sleep(1500)
    this.tourStart = getTime()
    print("TOUR_BEGIN")
    this.kit = new SiteZonesTestKit()
    this.rig = findSceneObjectByName("WearerRig").getTransform()
    this.camera = findSceneObjectByName("Camera Object").getTransform()
    this.siteWorld = findSceneObjectByName("SiteWorld").getTransform()
    // Establishing shot: a couple of meters behind the start, looking straight ahead.
    this.z = 200
    this.apply()
    await this.kit.switchTo("supervisor")
    await sleep(3000)
    await this.walkTo(0, 0, WALK_CM_PER_S, 0.04)
    await sleep(600)

    // ---- supervisor ----
    await this.markZone("floor", gapOutline(0), -60, -330)
    await this.markZone("floor", gapOutline(1), 120, -780)
    const swing: vec2[] = []
    for (let i = 0; i < 8; i++) {
      const angle = ((i + 0.5) / 8) * Math.PI * 2
      swing.push(new vec2(CRANE.x * 100 + Math.cos(angle) * CRANE.swingR * 100, -CRANE.y * 100 + Math.sin(angle) * CRANE.swingR * 100))
    }
    await this.markZone("crane", swing, 180, -620)

    await this.walkTo(0, 0, 220)
    await this.turnTo(0, 0, 1)
    await sleep(1800)
    await this.kit.switchTo("electrician")
    await sleep(1800)

    // ---- electrician ----
    const down = 0.24 // looking at the ground a few meters ahead
    await this.turnTo(0, down, 0.8)
    await this.walkTo(0, -830, WALK_CM_PER_S, down)
    // Drift left toward the floor opening while still looking ahead.
    await this.slideTo(-115, -900, 70)
    await sleep(2800)
    // Look at it: the beep and arrow stop.
    await this.turnTo(-Math.PI / 2, down, 1.0)
    await sleep(2200)
    // Look ahead again, then step back onto the path.
    await this.turnTo(0, down, 1.0)
    await sleep(1500)
    await this.slideTo(30, -960, 70)
    await sleep(800)
    await this.walkTo(60, -1050, WALK_CM_PER_S, down)
    await this.walkTo(-60, -1450, WALK_CM_PER_S, down)
    // Stop a few steps short of the work area and look at its outline and label.
    await this.walkTo(-30, -1850, WALK_CM_PER_S, down)
    await this.walkTo(0, -2150, WALK_CM_PER_S, down)
    await this.walkTo(-600, -2300, WALK_CM_PER_S, down)
    await this.walkTo(-420, -2380, WALK_CM_PER_S, down)
    await this.turnTo(Math.atan2(220, 220), 0.27, 0.9)
    await sleep(3000)
    print(`TOUR_END ${(getTime() - this.tourStart).toFixed(2)}`)
  }

  /** Walks near the hazard, then drops a corner at each point, picks the type and saves. */
  private async markZone(type: HazardType, corners: vec2[], standX: number, standZ: number): Promise<void> {
    await this.walkTo(standX, standZ, 220, 0.04)
    // Face the hazard and look at the panel to press Start Zone.
    const center = corners.reduce((sum, corner) => sum.add(corner), new vec2(0, 0)).uniformScale(1 / corners.length)
    const toward = Math.atan2(center.x - this.x, -(center.y - this.z))
    await this.turnTo(toward, PANEL_PITCH, 0.6)
    await sleep(500)
    await this.kit.pinch("StartZoneButton")
    await sleep(400)
    for (const corner of corners) {
      await this.lookAtFloor(corner.x, corner.y, 0.45)
      await this.kit.pinchGround(corner.x, corner.y)
    }
    // Back up to the panel for the hazard type and Save.
    await this.turnTo(toward, PANEL_PITCH, 0.7)
    await sleep(500)
    await this.kit.pinch(type === "crane" ? "CraneTypeButton" : "FloorTypeButton")
    await sleep(400)
    await this.kit.pinch("SaveButton")
    await sleep(1100)
  }

  /** Turns to face the way he is going, then walks there. */
  private async walkTo(x: number, z: number, speed: number, pitch: number = 0.1): Promise<void> {
    const heading = Math.atan2(x - this.x, -(z - this.z))
    await this.turnTo(heading, pitch, TURN_S)
    await this.slideTo(x, z, speed)
  }

  /** Moves without turning. */
  private async slideTo(x: number, z: number, speed: number): Promise<void> {
    const startX = this.x
    const startZ = this.z
    const seconds = Math.max(0.05, Math.sqrt((x - startX) ** 2 + (z - startZ) ** 2) / speed)
    await this.over(seconds, (t) => {
      this.x = startX + (x - startX) * t
      this.z = startZ + (z - startZ) * t
    })
  }

  private async turnTo(yaw: number, pitch: number, seconds: number): Promise<void> {
    const startYaw = this.yaw
    const startPitch = this.pitch
    let delta = yaw - startYaw
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    await this.over(seconds, (t) => {
      this.yaw = startYaw + delta * t
      this.pitch = startPitch + (pitch - startPitch) * t
    })
  }

  /** Looks at a point on the floor. `lift` raises the gaze a little above the point. */
  private async lookAtFloor(x: number, z: number, seconds: number, lift: number = 0): Promise<void> {
    const dx = x - this.x
    const dz = z - this.z
    const eyeHeight = -this.siteWorld.getLocalPosition().y
    const pitch = Math.min(MAX_FLOOR_PITCH, Math.atan2(eyeHeight, Math.sqrt(dx * dx + dz * dz)) - lift)
    await this.turnTo(Math.atan2(dx, -dz), pitch, seconds)
  }

  /** Runs `step` every frame with t easing from 0 to 1 over `seconds`. */
  private async over(seconds: number, step: (t: number) => void): Promise<void> {
    let elapsed = 0
    while (elapsed < seconds) {
      await nextFrame()
      elapsed += getDeltaTime()
      const t = Math.min(1, elapsed / seconds)
      step(t * t * (3 - 2 * t))
      this.apply()
    }
  }

  /** Puts the wearer's head at (x, z) at eye height with the current yaw and pitch. */
  private apply(): void {
    const eyeHeight = -this.siteWorld.getLocalPosition().y
    const eye = this.siteWorld.getWorldTransform().multiplyPoint(new vec3(this.x, eyeHeight, this.z))
    const flat = Math.cos(this.pitch)
    const gaze = new vec3(Math.sin(this.yaw) * flat, -Math.sin(this.pitch), -Math.cos(this.yaw) * flat)
    // The camera looks along its -z axis.
    const wanted = quat.lookAt(gaze.uniformScale(-1), vec3.up())
    const rigRotation = wanted.multiply(this.camera.getLocalRotation().invert())
    this.rig.setWorldRotation(rigRotation)
    this.rig.setWorldPosition(eye.sub(rigRotation.multiplyVec3(this.camera.getLocalPosition())))
    this.markBeep()
  }

  /** Prints when the warning beep starts and stops, so a recording can be given its sound afterward. */
  private markBeep(): void {
    const beeping = this.kit.report().beeping
    if (beeping !== this.beeping) {
      this.beeping = beeping
      print(`TOUR_BEEP ${beeping ? "on" : "off"} ${(getTime() - this.tourStart).toFixed(2)}`)
    }
  }
}
