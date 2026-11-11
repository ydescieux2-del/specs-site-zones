/**
 * Shared pieces for the two UI Kit panels: the type scale, text rows and buttons.
 * Sizes are in centimeters. Text is light, because dark content disappears on the
 * additive display.
 */
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {StateName} from "SpectaclesUIKit.lspkg/Scripts/Components/Element"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {
  RoundedRectangleVisual,
  RoundedRectangleVisualState,
} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual"

export type TextRole = "Headline" | "Button" | "Body" | "Caption"

/** Text sizes for a panel read from about 1 m. */
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Headline: {size: 58, weight: 700},
  Button: {size: 48, weight: 700},
  Body: {size: 44, weight: 600},
  Caption: {size: 40, weight: 600},
}

/**
 * Colors for a light panel. On the additive display anything dark is see-through,
 * so the plate and the buttons are bright fills with bright borders, and the text
 * is white.
 */
export type PanelColors = {
  /** Fill of the panel behind the buttons. */
  plate: vec4
  /** Border of the panel and of each button. */
  border: vec4
  /** Button fill at rest. */
  button: vec4
  /** Button fill while it is aimed at. */
  buttonHover: vec4
  /** Button fill while it is pinched. */
  buttonPress: vec4
  /** Text on the panel and on the buttons. */
  text: vec4
}

/**
 * Adds the panel's back plate in the light panel colors. UI Kit's BackPlate only
 * ships in dark styles and sets them when it starts, so the tint goes on in the
 * first frame after that.
 */
export function addBackPlate(host: BaseScriptComponent, colors: PanelColors): BackPlate {
  const root = host.getSceneObject()
  const backPlate = root.createComponent(BackPlate.getTypeName()) as BackPlate
  const firstFrame = host.createEvent("UpdateEvent")
  firstFrame.bind(() => {
    tintBackPlate(root, colors)
    firstFrame.enabled = false
  })
  return backPlate
}

function tintBackPlate(root: SceneObject, colors: PanelColors): void {
  const plate = root.getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
  if (!plate) {
    return
  }
  // Both stops the same color: a flat fill, set the same way the plate sets its own.
  plate.gradient = true
  plate.setBackgroundGradient({
    enabled: true,
    type: "Linear",
    start: new vec2(-1, 0),
    end: new vec2(1, 0),
    stop0: {enabled: true, percent: 0, color: colors.plate},
    stop1: {enabled: true, percent: 1, color: colors.plate},
  })
  plate.border = true
  plate.borderType = "Color"
  plate.borderSize = 0.14
  plate.borderColor = colors.border
}

// Lifts a label just in front of the button face so the face does not cover it.
const BUTTON_LABEL_Z_CM = 0.08

export function applyTextRole(text: Text, role: TextRole): void {
  text.size = TYPE_SCALE[role].size
  ;(text as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

/** A text row that takes part in a FlexLayout. Returns the Text so the caller can change it later. */
export function addText(
  parent: SceneObject,
  name: string,
  content: string,
  role: TextRole,
  widthCm: number,
  heightCm: number,
  color: vec4,
  wrap: boolean = false,
): Text {
  const object = global.scene.createSceneObject(name)
  object.setParent(parent)
  const text = object.createComponent("Component.Text") as Text
  text.text = content
  text.depthTest = true
  applyTextRole(text, role)
  text.horizontalAlignment = HorizontalAlignment.Center
  text.verticalAlignment = VerticalAlignment.Center
  text.horizontalOverflow = wrap ? HorizontalOverflow.Wrap : HorizontalOverflow.Overflow
  text.verticalOverflow = VerticalOverflow.Overflow
  text.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
  text.textFill.color = color
  const item = object.createComponent(FlexItem.getTypeName()) as FlexItem
  item.overrideWidth = widthCm
  item.overrideHeight = heightCm
  return text
}

/** A UI Kit button with a text label. The scene object takes `name`, which is what tests look up. */
export function addButton(
  parent: SceneObject,
  name: string,
  label: string,
  widthCm: number,
  heightCm: number,
  colors: PanelColors,
  onClick: () => void,
): Button {
  const object = global.scene.createSceneObject(name)
  object.setParent(parent)
  const button = object.createComponent(Button.getTypeName()) as Button
  // A light visual in place of the kit's dark default. It brightens when aimed at.
  const state = (fill: vec4, borderSize: number): RoundedRectangleVisualState => ({
    baseType: "Color",
    baseColor: fill,
    hasBorder: true,
    borderType: "Color",
    borderSize,
    borderColor: colors.border,
  })
  const style: Partial<Record<StateName, RoundedRectangleVisualState>> = {
    default: state(colors.button, 0.1),
    hovered: state(colors.buttonHover, 0.2),
    triggered: state(colors.buttonPress, 0.2),
  }
  button.visual = new RoundedRectangleVisual({sceneObject: object, style})
  button.size = new vec3(widthCm, heightCm, 1) // before the button initializes

  const labelObject = global.scene.createSceneObject(`${name}Label`)
  labelObject.setParent(object)
  labelObject.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z_CM))
  const text = labelObject.createComponent("Component.Text") as Text
  text.text = label
  text.depthTest = true
  applyTextRole(text, "Button")
  text.horizontalAlignment = HorizontalAlignment.Center
  text.verticalAlignment = VerticalAlignment.Center
  text.horizontalOverflow = HorizontalOverflow.Overflow
  text.verticalOverflow = VerticalOverflow.Overflow
  const labelWidth = widthCm - 0.5
  text.layoutRect = Rect.create(-labelWidth / 2, labelWidth / 2, -1.2, 1.2)
  text.textFill.color = colors.text

  const item = object.createComponent(FlexItem.getTypeName()) as FlexItem
  item.overrideWidth = widthCm
  item.overrideHeight = heightCm

  // UI Kit elements expose their own trigger events; these are safe to bind right away.
  button.onTriggerUp.add(onClick)
  return button
}
