/**
 * The supervisor's panel: Start Zone, the two hazard types, Clear last and Save,
 * with a status line saying what to do next. It floats about 1 m in front of the
 * supervisor, a little below eye level, and follows him.
 */
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {addBackPlate, addButton, addText, PanelColors} from "./UiParts"
import {HAZARD_LABEL, HazardType} from "./ZoneStore"

@component
export class SupervisorPanelUI extends BaseScriptComponent {
  @ui.label("Supervisor panel")
  @ui.separator
  @ui.group_start("Layout")
  @input
  @hint("Width of the panel's content, in cm")
  @widget(new SliderWidget(24, 50, 0.5))
  contentWidthCm: number = 36

  @input
  @hint("Height of each button, in cm. Keep it at 5 or more so it is easy to pinch")
  @widget(new SliderWidget(4, 10, 0.5))
  buttonHeightCm: number = 5.5

  @input
  @hint("Gap between rows and around the panel edge, in cm")
  @widget(new SliderWidget(0.5, 4, 0.1))
  gapCm: number = 1.3

  @input
  @hint("Heading at the top of the panel")
  title: string = "Mark a no-go zone"

  @input
  @hint("Color of the text. Keep it light: dark text disappears on the glasses")
  @widget(new ColorWidget())
  textColor: vec4 = new vec4(1, 1, 1, 1)

  @input
  @hint("Fill of the panel behind the buttons. Keep it mid-bright: dark fills are see-through on the glasses, and white text needs something to sit on")
  @widget(new ColorWidget())
  plateColor: vec4 = new vec4(0.2, 0.36, 0.56, 0.74)

  @input
  @hint("Border of the panel and of each button")
  @widget(new ColorWidget())
  borderColor: vec4 = new vec4(1, 1, 1, 0.95)

  @input
  @hint("Button fill at rest")
  @widget(new ColorWidget())
  buttonColor: vec4 = new vec4(0.2, 0.56, 1.0, 1)

  @input
  @hint("Button fill while it is aimed at")
  @widget(new ColorWidget())
  buttonHoverColor: vec4 = new vec4(0.45, 0.76, 1.0, 1)

  @input
  @hint("Button fill while it is pinched")
  @widget(new ColorWidget())
  buttonPressColor: vec4 = new vec4(0.72, 0.9, 1.0, 1)
  @ui.group_end
  @ui.group_start("Follow")
  @input
  @hint("How far in front of the supervisor the panel floats, in cm")
  @widget(new SliderWidget(60, 150, 1))
  followDistanceCm: number = 100

  @input
  @hint("How far below eye level the panel's center sits, in cm")
  @widget(new SliderWidget(0, 40, 1))
  dropBelowEyeCm: number = 14

  @input
  @hint("The panel stays put until the supervisor turns this many degrees away from it, then catches up")
  @widget(new SliderWidget(10, 60, 1))
  recenterDegrees: number = 30

  @input
  @hint("The panel also catches up when the supervisor has walked this far from where it expects him, in cm")
  @widget(new SliderWidget(10, 100, 1))
  recenterDistanceCm: number = 40
  @ui.group_end
  private statusText!: Text
  private camera = WorldCameraFinderProvider.getInstance()
  private target: vec3 | null = null
  private chasing = false

  private startZone = new Event<void>()
  private typeChosen = new Event<HazardType>()
  private clearLast = new Event<void>()
  private save = new Event<void>()

  get onStartZone(): PublicApi<void> {
    return this.startZone.publicApi()
  }

  get onTypeChosen(): PublicApi<HazardType> {
    return this.typeChosen.publicApi()
  }

  get onClearLast(): PublicApi<void> {
    return this.clearLast.publicApi()
  }

  get onSave(): PublicApi<void> {
    return this.save.publicApi()
  }

  /** Shows what the supervisor should do next. */
  setStatus(message: string): void {
    if (this.statusText) {
      this.statusText.text = message
    }
  }

  /** Shows or hides the panel. Showing it brings it straight in front of the wearer. */
  setVisible(visible: boolean): void {
    if (visible && !this.sceneObject.enabled) {
      this.target = null
    }
    this.sceneObject.enabled = visible
  }

  onAwake() {
    const width = this.contentWidthCm
    const half = (width - this.gapCm) / 2

    this.sceneObject.createComponent("Component.Canvas")
    const colors: PanelColors = {
      plate: this.plateColor,
      border: this.borderColor,
      button: this.buttonColor,
      buttonHover: this.buttonHoverColor,
      buttonPress: this.buttonPressColor,
      text: this.textColor,
    }
    const backPlate = addBackPlate(this, colors)

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, 0.6))

    const column = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    column.width = -1
    column.height = -1
    column.direction = FlexDirection.Column
    column.alignItems = FlexAlign.Center
    column.rowGap = this.gapCm
    column.paddingTop = this.gapCm * 1.2
    column.paddingBottom = this.gapCm * 1.2
    column.paddingLeft = this.gapCm * 1.2
    column.paddingRight = this.gapCm * 1.2
    column.onLayoutComplete.add((result) => {
      backPlate.size = new vec2(result.containerWidth, result.containerHeight)
    })

    addText(content, "PanelTitle", this.title, "Headline", width, 1.8, this.textColor)
    this.statusText = addText(content, "PanelStatus", "", "Body", width, 3.2, this.textColor, true)

    addButton(content, "StartZoneButton", "Start Zone", width, this.buttonHeightCm, colors, () =>
      this.startZone.invoke(),
    )

    const typeRow = this.addRow(content, "HazardTypeButtons", width)
    addButton(typeRow, "CraneTypeButton", HAZARD_LABEL.crane, half, this.buttonHeightCm, colors, () =>
      this.typeChosen.invoke("crane"),
    )
    addButton(typeRow, "FloorTypeButton", HAZARD_LABEL.floor, half, this.buttonHeightCm, colors, () =>
      this.typeChosen.invoke("floor"),
    )

    const actionRow = this.addRow(content, "ZoneActionButtons", width)
    addButton(actionRow, "ClearLastButton", "Clear last", half, this.buttonHeightCm, colors, () =>
      this.clearLast.invoke(),
    )
    addButton(actionRow, "SaveButton", "Save", half, this.buttonHeightCm, colors, () => this.save.invoke())

    this.createEvent("UpdateEvent").bind(() => this.follow())
  }

  private addRow(parent: SceneObject, name: string, widthCm: number): SceneObject {
    const rowObject = global.scene.createSceneObject(name)
    rowObject.setParent(parent)
    const row = rowObject.createComponent(FlexLayout.getTypeName()) as FlexLayout
    row.width = widthCm
    row.height = this.buttonHeightCm
    row.direction = FlexDirection.Row
    row.justifyContent = FlexJustify.SpaceBetween
    row.alignItems = FlexAlign.Center
    const item = rowObject.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = widthCm
    item.overrideHeight = this.buttonHeightCm
    return rowObject
  }

  /**
   * Keeps the panel in front of the supervisor without chasing every small head
   * movement: it holds still while he looks at it and pinches, and catches up once
   * he has turned or walked away.
   */
  private follow(): void {
    const eye = this.camera.getWorldPosition()
    const back = this.camera.back()
    const flatLength = Math.sqrt(back.x * back.x + back.z * back.z)
    if (flatLength < 0.05) {
      return // looking straight up or down: keep the last heading
    }
    const heading = new vec3(back.x / flatLength, 0, back.z / flatLength)
    const wanted = new vec3(
      eye.x + heading.x * this.followDistanceCm,
      eye.y - this.dropBelowEyeCm,
      eye.z + heading.z * this.followDistanceCm,
    )

    const transform = this.sceneObject.getTransform()
    if (this.target === null) {
      this.target = wanted
      transform.setWorldPosition(wanted)
    } else {
      const toPanel = new vec3(this.target.x - eye.x, 0, this.target.z - eye.z)
      const distance = toPanel.length
      const cosine = distance > 1 ? (toPanel.x * heading.x + toPanel.z * heading.z) / distance : 1
      const angle = (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI
      const drift = Math.abs(distance - this.followDistanceCm)
      if (angle > this.recenterDegrees || drift > this.recenterDistanceCm) {
        this.chasing = true
      }
      if (this.chasing) {
        this.target = vec3.lerp(this.target, wanted, Math.min(1, getDeltaTime() * 5))
        if (this.target.distance(wanted) < 2) {
          this.chasing = false
        }
      }
      // Height always tracks the eye, so crouching or stairs never leave it behind.
      this.target = new vec3(this.target.x, wanted.y, this.target.z)
      transform.setWorldPosition(this.target)
    }

    // Turn the panel's face (+z) toward the supervisor.
    const position = transform.getWorldPosition()
    transform.setWorldRotation(quat.fromEulerAngles(0, Math.atan2(eye.x - position.x, eye.z - position.z), 0))
  }
}
