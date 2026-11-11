/**
 * Site Zones: entry point.
 *
 * One preview shows two people. The supervisor marks no-go zones around the crane
 * and the floor openings; the electrician walks from his truck to his work area
 * and is shown those zones, with a beep and an arrow if he drifts toward one he is
 * not looking at. The "Supervisor / Electrician" switch stands in for two pairs of
 * glasses, and the JobSite model stands in for a real site.
 *
 * The Lens reinforces the site's physical barriers, covers and signs. It does not
 * replace them.
 */
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {ElectricianGuide, GuideReport} from "./ElectricianGuide"
import {Role, RoleSwitchUI} from "./RoleSwitchUI"
import {CRANE_UPPER_NODE} from "./SiteLayout"
import {SupervisorPanelUI} from "./SupervisorPanelUI"
import {SupervisorStatus, SupervisorTool} from "./SupervisorTool"
import {HazardType, ZoneStore} from "./ZoneStore"

export type SavedZoneReport = {
  id: number
  type: HazardType
  /** Corners as saved, in world space. */
  corners: vec3[]
}

@component
export class SiteZonesMain extends BaseScriptComponent {
  @ui.label("Site Zones")
  @ui.separator
  @ui.group_start("Scene")
  @input
  @hint("Root of the site. Its origin is on the floor beside the truck, where the wearer starts")
  siteWorld!: SceneObject

  @input
  @hint("The stand-in job site model (JobSite.glb). Only the crane's upper section is animated")
  jobSite!: SceneObject

  @input
  @hint("Parent for the path chevrons")
  pathAnchor!: SceneObject

  @input
  @hint("Placed at the electrician's work area. The work area outline and label are built under it")
  workArea!: SceneObject

  @input
  @hint("Parent for the zones shown in the supervisor's view")
  zonesRoot!: SceneObject

  @input
  @hint("Parent for the supervisor's corner markers")
  markersRoot!: SceneObject

  @input
  @hint("Centered on the floor slab. Becomes the surface the supervisor pinches to drop corners")
  groundTarget!: SceneObject

  @input
  @hint("The Supervisor / Electrician switch panel")
  roleSwitch!: RoleSwitchUI

  @input
  @hint("The supervisor's panel")
  supervisorPanel!: SupervisorPanelUI
  @ui.group_end
  @ui.group_start("Wearer")
  @input
  @hint("Which view the Lens opens in. The supervisor goes first, because zones have to be marked before they can be shown")
  @widget(new ComboBoxWidget([new ComboBoxItem("Supervisor", "supervisor"), new ComboBoxItem("Electrician", "electrician")]))
  startRole: string = "supervisor"

  @input
  @hint("Height of the wearer's eyes above the floor, in cm. The site is placed this far below the glasses")
  @widget(new SliderWidget(120, 200, 1))
  eyeHeightCm: number = 165
  @ui.group_end
  @ui.group_start("When things show")
  @input
  @hint("A zone appears when the electrician is this close to its edge, in cm")
  @widget(new SliderWidget(100, 1000, 10))
  appearDistanceCm: number = 500

  @input
  @hint("A zone turns from yellow to red this close to its edge, or inside it, in cm")
  @widget(new SliderWidget(0, 300, 5))
  dangerDistanceCm: number = 100

  @input
  @hint("The beep and arrow can start this close to a zone's edge, in cm")
  @widget(new SliderWidget(50, 500, 5))
  warnDistanceCm: number = 200

  @input
  @hint("The beep and arrow start when the zone is this many degrees from the center of his view")
  @widget(new SliderWidget(5, 60, 1))
  lookAwayDegrees: number = 20

  @input
  @hint("The work area marker appears this close to the end of the path, in cm")
  @widget(new SliderWidget(100, 1000, 10))
  workAreaDistanceCm: number = 500

  @input
  @hint("Loudness of the warning beep, 0 to 1")
  @widget(new SliderWidget(0, 1, 0.05))
  beepVolume: number = 1
  @ui.group_end
  @ui.group_start("Crane stand-in")
  @input
  @hint("How far the crane's upper section swings to each side, in degrees")
  @widget(new SliderWidget(0, 180, 1))
  craneSwingDegrees: number = 55

  @input
  @hint("Seconds for one full swing there and back")
  @widget(new SliderWidget(5, 120, 1))
  craneSwingSeconds: number = 28
  @ui.group_end
  private store = new ZoneStore()
  private supervisor: SupervisorTool | null = null
  private guide: ElectricianGuide | null = null
  private camera = WorldCameraFinderProvider.getInstance()
  private currentRole: Role = "supervisor"
  private roleApplied = false
  private craneUpper: SceneObject | null = null
  private craneRest = quat.quatIdentity()

  onAwake() {
    if (
      !this.siteWorld ||
      !this.jobSite ||
      !this.pathAnchor ||
      !this.workArea ||
      !this.zonesRoot ||
      !this.markersRoot ||
      !this.groundTarget ||
      !this.roleSwitch ||
      !this.supervisorPanel
    ) {
      print("SiteZonesMain: a required input is not set. Check the SiteZones object in the Inspector.")
      return
    }

    // The glasses start at eye height, so the floor is that far below them.
    const worldTransform = this.siteWorld.getTransform()
    const worldPosition = worldTransform.getLocalPosition()
    worldTransform.setLocalPosition(new vec3(worldPosition.x, -this.eyeHeightCm, worldPosition.z))

    this.craneUpper = findByName(this.jobSite, CRANE_UPPER_NODE)
    if (this.craneUpper) {
      this.craneRest = this.craneUpper.getTransform().getLocalRotation()
    } else {
      print(`SiteZonesMain: no "${CRANE_UPPER_NODE}" node in the job site model, so the crane will not swing.`)
    }

    // SIK components are created and wired on start, once SIK itself is ready.
    this.createEvent("OnStartEvent").bind(() => this.start())
    this.createEvent("UpdateEvent").bind(() => this.update())
  }

  // ---- for the panels, and for tests --------------------------------------

  /** The view that is on. */
  get role(): Role {
    return this.currentRole
  }

  /** Switches between the supervisor's and the electrician's view. */
  setRole(role: Role): void {
    this.currentRole = role
    this.roleApplied = true
    this.supervisor?.setActive(role === "supervisor")
    this.supervisorPanel.setVisible(role === "supervisor")
    this.guide?.setActive(role === "electrician")
    this.roleSwitch.setRole(role)
  }

  /** What the supervisor's tool is doing. */
  supervisorStatus(): SupervisorStatus | null {
    return this.supervisor ? this.supervisor.status : null
  }

  /** Corners of the zone the supervisor is drawing, as its outline is drawn, in world space. */
  draftCorners(): vec3[] {
    return this.supervisor ? this.supervisor.draftCornersWorld : []
  }

  /** What the electrician is being shown right now. */
  guideReport(): GuideReport | null {
    return this.guide ? this.guide.report() : null
  }

  /** The zones the supervisor has saved. */
  savedZones(): SavedZoneReport[] {
    const toWorld = this.siteWorld.getTransform().getWorldTransform()
    return this.store.zones.map((zone) => ({
      id: zone.id,
      type: zone.type,
      corners: zone.points.map((point) => toWorld.multiplyPoint(point)),
    }))
  }

  // ---- lifecycle ----------------------------------------------------------

  private start(): void {
    this.supervisor = new SupervisorTool(this.store, this.siteWorld, this.zonesRoot, this.markersRoot, this.groundTarget)
    this.guide = new ElectricianGuide(
      this.store,
      this.siteWorld,
      this.sceneObject,
      this.pathAnchor,
      this.workArea,
      this.camera.getComponent().getSceneObject(),
      {
        appearDistanceCm: this.appearDistanceCm,
        dangerDistanceCm: this.dangerDistanceCm,
        warnDistanceCm: this.warnDistanceCm,
        lookAwayDegrees: this.lookAwayDegrees,
        workAreaDistanceCm: this.workAreaDistanceCm,
        beepVolume: this.beepVolume,
      },
    )

    this.supervisor.onStatusChanged.add((status) => this.supervisorPanel.setStatus(status.message))
    this.supervisorPanel.setStatus(this.supervisor.status.message)

    this.supervisorPanel.onStartZone.add(() => this.supervisor?.startZone())
    this.supervisorPanel.onTypeChosen.add((type) => this.supervisor?.chooseType(type))
    this.supervisorPanel.onClearLast.add(() => this.supervisor?.clearLast())
    this.supervisorPanel.onSave.add(() => this.supervisor?.save())
    this.roleSwitch.onRoleChosen.add((role) => this.setRole(role))
  }

  private update(): void {
    if (!this.supervisor || !this.guide) {
      return
    }
    if (!this.roleApplied) {
      // Applied on the first frame rather than on start, so both panels have
      // finished setting themselves up before one of them is hidden.
      this.setRole(this.startRole === "electrician" ? "electrician" : "supervisor")
    }

    const cameraTransform = this.camera.getTransform()
    this.guide.update(getDeltaTime(), cameraTransform.getWorldPosition(), cameraTransform.back, cameraTransform.getWorldRotation())

    if (this.craneUpper && this.craneSwingSeconds > 0) {
      const angle =
        ((this.craneSwingDegrees * Math.PI) / 180) * Math.sin((getTime() * 2 * Math.PI) / this.craneSwingSeconds)
      this.craneUpper.getTransform().setLocalRotation(this.craneRest.multiply(quat.angleAxis(angle, vec3.up())))
    }
  }
}

function findByName(root: SceneObject, name: string): SceneObject | null {
  if (root.name === name) {
    return root
  }
  for (let i = 0; i < root.getChildrenCount(); i++) {
    const found = findByName(root.getChild(i), name)
    if (found) {
      return found
    }
  }
  return null
}
