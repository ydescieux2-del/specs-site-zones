/**
 * Small flat meshes built in code: floor ribbons, zone fills, chevrons, discs,
 * sign panels and the warning arrow. All of them are drawn with a two-sided unlit
 * material, so triangle winding does not matter here.
 *
 * Floor meshes lie in the x-z plane. Upright meshes (sign panels, the arrow) lie in
 * the x-y plane and face +z.
 */
import {triangulate} from "./ZoneMath"

const baseMaterial = requireAsset("../Materials/SiteUnlit.mat") as Material

const VERTEX_LAYOUT = [
  {name: "position", components: 3},
  {name: "normal", components: 3, normalized: true},
  {name: "texture0", components: 2},
]

/** A mesh that can be rebuilt in place, for outlines that change while a marker is dragged. */
export class FlatMesh {
  private builder: MeshBuilder
  private vertexCount = 0

  constructor() {
    this.builder = new MeshBuilder(VERTEX_LAYOUT)
    this.builder.topology = MeshTopology.Triangles
    this.builder.indexType = MeshIndexType.UInt16
  }

  get mesh(): RenderMesh {
    return this.builder.getMesh()
  }

  clear(): void {
    const vertices = this.builder.getVerticesCount()
    if (vertices > 0) {
      this.builder.eraseVertices(0, vertices)
    }
    const indices = this.builder.getIndicesCount()
    if (indices > 0) {
      this.builder.eraseIndices(0, indices)
    }
    this.vertexCount = 0
  }

  /** Adds a vertex with an up-facing normal and returns its index. */
  addFloorVertex(x: number, y: number, z: number): number {
    this.builder.appendVerticesInterleaved([x, y, z, 0, 1, 0, 0, 0])
    return this.vertexCount++
  }

  /** Adds a vertex facing +z and returns its index. */
  addUprightVertex(x: number, y: number, u: number = 0, v: number = 0): number {
    this.builder.appendVerticesInterleaved([x, y, 0, 0, 0, 1, u, v])
    return this.vertexCount++
  }

  addTriangle(a: number, b: number, c: number): void {
    this.builder.appendIndices([a, b, c])
  }

  addQuad(a: number, b: number, c: number, d: number): void {
    this.builder.appendIndices([a, b, c, a, c, d])
  }

  /** Pushes the changes to the GPU. Call once after a batch of edits. */
  apply(): void {
    this.builder.updateMesh()
  }

  // ---- floor shapes -------------------------------------------------------

  /** A strip of the given width along a-b, extended by half the width at each end so corners join. */
  addFloorSegment(a: vec3, b: vec3, width: number, y: number): void {
    let dx = b.x - a.x
    let dz = b.z - a.z
    const length = Math.sqrt(dx * dx + dz * dz)
    if (length < 1e-3) {
      return
    }
    dx /= length
    dz /= length
    const half = width / 2
    // The side direction is the travel direction turned 90 degrees on the floor.
    const sx = -dz * half
    const sz = dx * half
    const ax = a.x - dx * half
    const az = a.z - dz * half
    const bx = b.x + dx * half
    const bz = b.z + dz * half
    this.addQuad(
      this.addFloorVertex(ax + sx, y, az + sz),
      this.addFloorVertex(bx + sx, y, bz + sz),
      this.addFloorVertex(bx - sx, y, bz - sz),
      this.addFloorVertex(ax - sx, y, az - sz),
    )
  }

  /** Strips joining each point to the next. `closed` also joins the last back to the first. */
  addFloorOutline(points: vec3[], width: number, y: number, closed: boolean): void {
    const last = closed ? points.length : points.length - 1
    for (let i = 0; i < last; i++) {
      this.addFloorSegment(points[i], points[(i + 1) % points.length], width, y)
    }
  }

  /** The inside of a closed outline. */
  addFloorFill(points: vec3[], y: number): void {
    const first = this.vertexCount
    for (const point of points) {
      this.addFloorVertex(point.x, y, point.z)
    }
    const triangles = triangulate(points)
    for (let i = 0; i < triangles.length; i += 3) {
      this.addTriangle(first + triangles[i], first + triangles[i + 1], first + triangles[i + 2])
    }
  }

  /** A flat disc on the floor, centered on the mesh origin. */
  addFloorDisc(radius: number, y: number, segments: number = 28): void {
    const center = this.addFloorVertex(0, y, 0)
    const rim: number[] = []
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      rim.push(this.addFloorVertex(Math.cos(angle) * radius, y, Math.sin(angle) * radius))
    }
    for (let i = 0; i < segments; i++) {
      this.addTriangle(center, rim[i], rim[(i + 1) % segments])
    }
  }

  /** A flat ring on the floor, centered on the mesh origin. */
  addFloorRing(innerRadius: number, outerRadius: number, y: number, segments: number = 28): void {
    const inner: number[] = []
    const outer: number[] = []
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      inner.push(this.addFloorVertex(Math.cos(angle) * innerRadius, y, Math.sin(angle) * innerRadius))
      outer.push(this.addFloorVertex(Math.cos(angle) * outerRadius, y, Math.sin(angle) * outerRadius))
    }
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments
      this.addQuad(inner[i], outer[i], outer[next], inner[next])
    }
  }

  /**
   * One chevron on the floor at `center`, pointing along `forward` (a unit vector on
   * the floor). `width` is the full span across; `thickness` is how thick each arm is
   * along the direction of travel.
   */
  addFloorChevron(center: vec3, forward: vec3, width: number, thickness: number, y: number): void {
    const half = width / 2
    const rise = half * 0.7 // how far the tip sits ahead of the arm ends
    const fx = forward.x
    const fz = forward.z
    const rx = -fz
    const rz = fx
    const at = (side: number, ahead: number): number =>
      this.addFloorVertex(center.x + rx * side + fx * ahead, y, center.z + rz * side + fz * ahead)
    const back = -rise / 2
    for (const sign of [-1, 1]) {
      this.addQuad(
        at(sign * half, back),
        at(sign * half, back + thickness),
        at(0, back + rise + thickness),
        at(0, back + rise),
      )
    }
  }

  // ---- upright shapes -----------------------------------------------------

  /** A rectangle in the x-y plane. (cx, cy) is its center. */
  addUprightRect(cx: number, cy: number, width: number, height: number): void {
    const hw = width / 2
    const hh = height / 2
    this.addQuad(
      this.addUprightVertex(cx - hw, cy - hh, 0, 0),
      this.addUprightVertex(cx + hw, cy - hh, 1, 0),
      this.addUprightVertex(cx + hw, cy + hh, 1, 1),
      this.addUprightVertex(cx - hw, cy + hh, 0, 1),
    )
  }

  /** An arrow in the x-y plane pointing along +y, centered on the mesh origin. */
  addUprightArrow(length: number, headWidth: number, stemWidth: number): void {
    const headLength = length * 0.5
    const tipY = length / 2
    const neckY = tipY - headLength
    const tailY = -length / 2
    this.addTriangle(
      this.addUprightVertex(0, tipY),
      this.addUprightVertex(-headWidth / 2, neckY),
      this.addUprightVertex(headWidth / 2, neckY),
    )
    this.addQuad(
      this.addUprightVertex(-stemWidth / 2, tailY),
      this.addUprightVertex(stemWidth / 2, tailY),
      this.addUprightVertex(stemWidth / 2, neckY),
      this.addUprightVertex(-stemWidth / 2, neckY),
    )
  }
}

/**
 * A flat-colored material instance. Alpha in the color fades the whole mesh.
 * Depth is tested but not written, so overlapping floor graphics do not cut holes
 * in each other.
 */
export function makeFlatMaterial(color: vec4): Material {
  const material = baseMaterial.clone()
  const pass = material.mainPass
  pass.blendMode = BlendMode.PremultipliedAlphaAuto
  pass.twoSided = true
  pass.depthTest = true
  pass.depthWrite = false
  pass.baseColor = color
  return material
}

/** Creates a child scene object that draws `mesh` with `material`. */
export function makeVisual(
  parent: SceneObject,
  name: string,
  mesh: RenderMesh,
  material: Material,
  renderOrder: number = 0,
): SceneObject {
  const object = global.scene.createSceneObject(name)
  object.setParent(parent)
  const visual = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
  visual.mesh = mesh
  visual.mainMaterial = material
  visual.setRenderOrder(renderOrder)
  return object
}

/** Same color with a different alpha. */
export function withAlpha(color: vec4, alpha: number): vec4 {
  return new vec4(color.x, color.y, color.z, alpha)
}
