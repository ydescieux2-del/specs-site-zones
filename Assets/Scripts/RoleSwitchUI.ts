/**
 * The "Supervisor / Electrician" switch at the truck. It stands in for two people
 * each wearing their own glasses: one preview shows both views.
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {addBackPlate, addButton, addText, PanelColors} from "./UiParts"

export type Role = "supervisor" | "electrician"

const ROLE_NAME: Record<Role, string> = {
  supervisor: "Supervisor",
  electrician: "Electrician",
}

@component
export class RoleSwitchUI extends BaseScriptComponent {
  @ui.label("Supervisor / Electrician switch")
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Width of each of the two buttons, in cm")
  @widget(new SliderWidget(8, 24, 0.5))
  buttonWidthCm: number = 15

  @input
  @hint("Height of each button, in cm. Keep it at 5 or more so it is easy to pinch")
  @widget(new SliderWidget(4, 10, 0.5))
  buttonHeightCm: number = 5.5

  @input
  @hint("Gap between the buttons and around the panel edge, in cm")
  @widget(new SliderWidget(0.5, 4, 0.1))
  gapCm: number = 1.4

  @input
  @hint("Line above the buttons. The current view is added after it. The switch stands in for two pairs of glasses")
  caption: string = "Viewing as"

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
  private captionText!: Text
  private roleChosen = new Event<Role>()

  /** Fires with the role the wearer pinched. */
  get onRoleChosen(): PublicApi<Role> {
    return this.roleChosen.publicApi()
  }

  /** Updates the caption to show which view is on. */
  setRole(role: Role): void {
    if (this.captionText) {
      this.captionText.text = `${this.caption}: ${ROLE_NAME[role]}`
    }
  }

  onAwake() {
    const rowWidth = this.buttonWidthCm * 2 + this.gapCm

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
    column.rowGap = this.gapCm * 0.7
    column.paddingTop = this.gapCm
    column.paddingBottom = this.gapCm
    column.paddingLeft = this.gapCm
    column.paddingRight = this.gapCm
    column.onLayoutComplete.add((result) => {
      backPlate.size = new vec2(result.containerWidth, result.containerHeight)
    })

    this.captionText = addText(content, "RoleCaption", `${this.caption}:`, "Body", rowWidth, 1.8, this.textColor)

    const rowObject = global.scene.createSceneObject("RoleButtons")
    rowObject.setParent(content)
    const row = rowObject.createComponent(FlexLayout.getTypeName()) as FlexLayout
    row.width = rowWidth
    row.height = this.buttonHeightCm
    row.direction = FlexDirection.Row
    row.justifyContent = FlexJustify.SpaceBetween
    row.alignItems = FlexAlign.Center
    const rowItem = rowObject.createComponent(FlexItem.getTypeName()) as FlexItem
    rowItem.overrideWidth = rowWidth
    rowItem.overrideHeight = this.buttonHeightCm

    addButton(rowObject, "SupervisorButton", "Supervisor", this.buttonWidthCm, this.buttonHeightCm, colors, () =>
      this.roleChosen.invoke("supervisor"),
    )
    addButton(rowObject, "ElectricianButton", "Electrician", this.buttonWidthCm, this.buttonHeightCm, colors, () =>
      this.roleChosen.invoke("electrician"),
    )
  }
}
