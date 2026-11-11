/**
 * Draws one zone: an outline on the floor joining its corners, a light fill inside,
 * and (for the electrician) a Danger sign standing in the zone.
 *
 * The sign follows the OSHA danger sign in 29 CFR 1926.200: the word DANGER in
 * white on red, with one short line under it. It reinforces the physical signs and
 * barriers on site; it does not replace them.
 */
import {FlatMesh, makeFlatMaterial, makeVisual, withAlpha} from "./MeshKit"
import {centroid, isInside, nearestOnOutline} from "./ZoneMath"

export type ZoneLook = "caution" | "danger" | "draft"

// The preview lifts dark channels a little, so these are fully saturated to read as true yellow and red.
const LOOK_COLOR: Record<ZoneLook, vec4> = {
  // Caution yellow and danger red, as in 1926.200. Draft is a neutral light blue-white.
  caution: new vec4(1.0, 0.82, 0.0, 1),
  danger: new vec4(1.0, 0.02, 0.01, 1),
  draft: new vec4(0.7, 0.9, 1.0, 1),
}

const OUTLINE_WIDTH_CM = 10
const OUTLINE_Y_CM = 2.6
const FILL_Y_CM = 2.0
const OUTLINE_ALPHA = 0.95
const FILL_ALPHA = 0.3

// Sign size and height from the design brief: about 50 x 35 cm, top at 1.2 m.
const SIGN_WIDTH_CM = 50
const SIGN_HEADER_CM = 14
const SIGN_BODY_CM = 21
const SIGN_TOP_CM = 120
const SIGN_INSET_CM = 30 // how far inside the zone edge the sign stands
const SIGN_RED = new vec4(0.8, 0.005, 0.005, 1)
const SIGN_WHITE = new vec4(1, 1, 1, 1)
const SIGN_BODY_TEXT = new vec4(0.45, 0.0, 0.0, 1)

// Lens Studio text size 48 draws an em square about 1.09 cm tall at scale 1.
const TEXT_SIZE = 48
const HEADER_TEXT_SCALE = 8.2
const BODY_TEXT_SCALE = 4.9

export class ZoneVisual {
  readonly root: SceneObject

  private outlineMesh = new FlatMesh()
  private fillMesh = new FlatMesh()
  private outlineMaterial: Material
  private fillMaterial: Material
  private outlineObject: SceneObject
  private fillObject: SceneObject

  private look: ZoneLook = "draft"
  private opacity = 1
  private points: vec3[] = []
  private closed = false

  private sign: SceneObject | null = null
  private signMaterials: {material: Material; color: vec4}[] = []
  private signTexts: {text: Text; color: vec4}[] = []
  private signPlaced = false

  constructor(parent: SceneObject, name: string) {
    this.root = global.scene.createSceneObject(name)
    this.root.setParent(parent)
    this.outlineMaterial = makeFlatMaterial(LOOK_COLOR.draft)
    this.fillMaterial = makeFlatMaterial(LOOK_COLOR.draft)
    this.fillObject = makeVisual(this.root, "ZoneFill", this.fillMesh.mesh, this.fillMaterial, 1)
    this.outlineObject = makeVisual(this.root, "ZoneOutline", this.outlineMesh.mesh, this.outlineMaterial, 2)
    this.applyColors()
  }

  /** The corners this visual is currently drawing, in world space. */
  get worldCorners(): vec3[] {
    const toWorld = this.root.getTransform().getWorldTransform()
    return this.points.map((point) => toWorld.multiplyPoint(point))
  }

  get currentLook(): ZoneLook {
    return this.look
  }

  get currentOpacity(): number {
    return this.opacity
  }

  get signObject(): SceneObject | null {
    return this.sign
  }

  /** Redraws the outline through `points`. A closed outline with three or more corners also gets a fill. */
  setShape(points: vec3[], closed: boolean): void {
    this.points = points.map((point) => new vec3(point.x, 0, point.z))
    this.closed = closed && points.length >= 3

    this.outlineMesh.clear()
    if (this.points.length >= 2) {
      this.outlineMesh.addFloorOutline(this.points, OUTLINE_WIDTH_CM, OUTLINE_Y_CM, this.closed)
    }
    this.outlineMesh.apply()

    this.fillMesh.clear()
    if (this.closed) {
      this.fillMesh.addFloorFill(this.points, FILL_Y_CM)
    }
    this.fillMesh.apply()

    this.outlineObject.enabled = this.points.length >= 2 && this.opacity > 0.01
    this.fillObject.enabled = this.closed && this.opacity > 0.01
  }

  setLook(look: ZoneLook): void {
    if (look === this.look) {
      return
    }
    this.look = look
    this.applyColors()
  }

  /** 0 hides the zone, 1 shows it fully. */
  setOpacity(opacity: number): void {
    const clamped = Math.max(0, Math.min(1, opacity))
    if (Math.abs(clamped - this.opacity) < 0.002) {
      return
    }
    this.opacity = clamped
    const visible = clamped > 0.01
    this.outlineObject.enabled = visible && this.points.length >= 2
    this.fillObject.enabled = visible && this.closed
    if (this.sign) {
      this.sign.enabled = visible
    }
    this.applyColors()
  }

  /** Adds the Danger sign with the given line under the word DANGER. */
  addSign(label: string): void {
    if (this.sign) {
      return
    }
    const sign = global.scene.createSceneObject("DangerSign")
    sign.setParent(this.root)
    this.sign = sign

    const headerY = SIGN_TOP_CM - SIGN_HEADER_CM / 2
    const bodyY = SIGN_TOP_CM - SIGN_HEADER_CM - SIGN_BODY_CM / 2
    const bottomY = SIGN_TOP_CM - SIGN_HEADER_CM - SIGN_BODY_CM

    this.addSignPanel(sign, "SignPost", 0, bottomY / 2, 3, bottomY, SIGN_WHITE, 3)
    this.addSignPanel(sign, "SignBody", 0, bodyY, SIGN_WIDTH_CM, SIGN_BODY_CM, SIGN_WHITE, 3)
    this.addSignPanel(sign, "SignHeader", 0, headerY, SIGN_WIDTH_CM, SIGN_HEADER_CM, SIGN_RED, 3)
    this.addSignText(sign, "SignHeaderText", "DANGER", headerY, HEADER_TEXT_SCALE, SIGN_WHITE)
    this.addSignText(sign, "SignBodyText", label, bodyY, BODY_TEXT_SCALE, SIGN_BODY_TEXT)

    sign.enabled = this.opacity > 0.01
    this.applyColors()
  }

  /**
   * Stands the sign inside the zone at the edge nearest the wearer and turns it to
   * face him. `wearer` is in the same frame as the zone's points.
   */
  placeSign(wearer: vec3): void {
    if (!this.sign || this.points.length < 3) {
      return
    }
    const transform = this.sign.getTransform()
    if (isInside(wearer, this.points) && this.signPlaced) {
      // He is inside the zone: leave the sign where it is and keep it facing him.
      this.faceSign(transform.getLocalPosition(), wearer)
      return
    }

    const nearest = nearestOnOutline(wearer, this.points)
    let dx = nearest.point.x - wearer.x
    let dz = nearest.point.z - wearer.z
    const length = Math.sqrt(dx * dx + dz * dz)
    let spot = centroid(this.points)
    if (length > 1) {
      dx /= length
      dz /= length
      for (const inset of [SIGN_INSET_CM, SIGN_INSET_CM / 2, 5]) {
        const candidate = new vec3(nearest.point.x + dx * inset, 0, nearest.point.z + dz * inset)
        if (isInside(candidate, this.points)) {
          spot = candidate
          break
        }
      }
    }

    if (this.signPlaced) {
      // Ease toward the new spot so the sign glides along the edge as he walks.
      const current = transform.getLocalPosition()
      spot = new vec3(current.x + (spot.x - current.x) * 0.2, 0, current.z + (spot.z - current.z) * 0.2)
    }
    transform.setLocalPosition(spot)
    this.signPlaced = true
    this.faceSign(spot, wearer)
  }

  destroy(): void {
    this.root.destroy()
  }

  private faceSign(spot: vec3, wearer: vec3): void {
    if (!this.sign) {
      return
    }
    const dx = wearer.x - spot.x
    const dz = wearer.z - spot.z
    if (dx * dx + dz * dz < 1) {
      return
    }
    // The sign's face is +z. Turning by atan2(dx, dz) about y points +z at the wearer.
    this.sign.getTransform().setLocalRotation(quat.fromEulerAngles(0, Math.atan2(dx, dz), 0))
  }

  private addSignPanel(
    parent: SceneObject,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color: vec4,
    renderOrder: number,
  ): void {
    const mesh = new FlatMesh()
    mesh.addUprightRect(x, y, width, height)
    mesh.apply()
    const material = makeFlatMaterial(color)
    makeVisual(parent, name, mesh.mesh, material, renderOrder)
    this.signMaterials.push({material, color})
  }

  private addSignText(
    parent: SceneObject,
    name: string,
    content: string,
    y: number,
    scale: number,
    color: vec4,
  ): void {
    const object = global.scene.createSceneObject(name)
    object.setParent(parent)
    const transform = object.getTransform()
    // A few millimeters in front of the panel so the text never z-fights with it.
    transform.setLocalPosition(new vec3(0, y, 0.5))
    transform.setLocalScale(new vec3(scale, scale, scale))
    const text = object.createComponent("Component.Text") as Text
    text.text = content
    text.size = TEXT_SIZE
    ;(text as Text & {weight?: number}).weight = 700
    text.depthTest = true
    text.horizontalAlignment = HorizontalAlignment.Center
    text.verticalAlignment = VerticalAlignment.Center
    text.horizontalOverflow = HorizontalOverflow.Overflow
    text.verticalOverflow = VerticalOverflow.Overflow
    text.textFill.color = color
    text.setRenderOrder(4)
    this.signTexts.push({text, color})
  }

  private applyColors(): void {
    const color = LOOK_COLOR[this.look]
    this.outlineMaterial.mainPass.baseColor = withAlpha(color, OUTLINE_ALPHA * this.opacity)
    this.fillMaterial.mainPass.baseColor = withAlpha(color, FILL_ALPHA * this.opacity)
    for (const entry of this.signMaterials) {
      entry.material.mainPass.baseColor = withAlpha(entry.color, this.opacity)
    }
    for (const entry of this.signTexts) {
      entry.text.textFill.color = withAlpha(entry.color, this.opacity)
    }
  }
}
