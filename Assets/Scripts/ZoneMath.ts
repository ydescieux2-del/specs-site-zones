/**
 * Flat geometry for zones. Everything here works on the floor plane: only x and z
 * of each vec3 are used, and y is ignored.
 */

export type NearestResult = {
  /** Distance in cm from the point to the nearest spot on the outline. */
  distance: number
  /** The nearest spot on the outline (y = 0). */
  point: vec3
}

/** Nearest point to `p` on the segment a-b. */
export function nearestOnSegment(p: vec3, a: vec3, b: vec3): vec3 {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const lengthSq = abx * abx + abz * abz
  if (lengthSq < 1e-6) {
    return new vec3(a.x, 0, a.z)
  }
  let t = ((p.x - a.x) * abx + (p.z - a.z) * abz) / lengthSq
  t = Math.max(0, Math.min(1, t))
  return new vec3(a.x + abx * t, 0, a.z + abz * t)
}

/** Nearest point on a closed outline, and how far away it is. */
export function nearestOnOutline(p: vec3, points: vec3[]): NearestResult {
  let best = Number.MAX_VALUE
  let bestPoint = new vec3(p.x, 0, p.z)
  for (let i = 0; i < points.length; i++) {
    const candidate = nearestOnSegment(p, points[i], points[(i + 1) % points.length])
    const dx = candidate.x - p.x
    const dz = candidate.z - p.z
    const distance = Math.sqrt(dx * dx + dz * dz)
    if (distance < best) {
      best = distance
      bestPoint = candidate
    }
  }
  return {distance: best, point: bestPoint}
}

/** True when `p` is inside the closed outline (even-odd rule). */
export function isInside(p: vec3, points: vec3[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]
    const b = points[j]
    const crosses = a.z > p.z !== b.z > p.z
    if (crosses && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) {
      inside = !inside
    }
  }
  return inside
}

/** Distance to the outline: positive outside, negative inside. */
export function signedDistance(p: vec3, points: vec3[]): number {
  const nearest = nearestOnOutline(p, points)
  return isInside(p, points) ? -nearest.distance : nearest.distance
}

/** Average of the corners. */
export function centroid(points: vec3[]): vec3 {
  let x = 0
  let z = 0
  for (const point of points) {
    x += point.x
    z += point.z
  }
  return new vec3(x / points.length, 0, z / points.length)
}

/** Twice the signed area. Positive when the corners run counter-clockwise seen from above (+y). */
function signedArea2(points: vec3[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.z * b.x - a.x * b.z
  }
  return sum
}

function cross(a: vec3, b: vec3, c: vec3): number {
  return (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z)
}

function triangleContains(a: vec3, b: vec3, c: vec3, p: vec3): boolean {
  const d1 = cross(a, b, p)
  const d2 = cross(b, c, p)
  const d3 = cross(c, a, p)
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNegative && hasPositive)
}

/**
 * Splits a simple outline into triangles by ear clipping. Returns corner indices,
 * three per triangle. Works for dented (concave) outlines. An outline that crosses
 * itself falls back to a fan from the first corner.
 */
export function triangulate(points: vec3[]): number[] {
  const count = points.length
  if (count < 3) {
    return []
  }
  const remaining: number[] = []
  for (let i = 0; i < count; i++) {
    remaining.push(i)
  }
  if (signedArea2(points) < 0) {
    remaining.reverse()
  }

  const triangles: number[] = []
  let guard = count * count
  while (remaining.length > 3 && guard-- > 0) {
    let clipped = false
    for (let i = 0; i < remaining.length; i++) {
      const prev = remaining[(i + remaining.length - 1) % remaining.length]
      const current = remaining[i]
      const next = remaining[(i + 1) % remaining.length]
      const a = points[prev]
      const b = points[current]
      const c = points[next]
      if (cross(a, b, c) <= 0) {
        continue
      }
      let blocked = false
      for (const other of remaining) {
        if (other === prev || other === current || other === next) {
          continue
        }
        if (triangleContains(a, b, c, points[other])) {
          blocked = true
          break
        }
      }
      if (blocked) {
        continue
      }
      triangles.push(prev, current, next)
      remaining.splice(i, 1)
      clipped = true
      break
    }
    if (!clipped) {
      break
    }
  }

  if (remaining.length === 3) {
    triangles.push(remaining[0], remaining[1], remaining[2])
    return triangles
  }

  const fan: number[] = []
  for (let i = 1; i < count - 1; i++) {
    fan.push(0, i, i + 1)
  }
  return fan
}

/**
 * Smallest angle, in degrees, between a heading and any part of the outline as seen
 * from `eye`. 0 means the heading points straight at the outline. Both the heading
 * and the outline are flattened onto the floor.
 */
export function angleToOutline(eye: vec3, heading: vec3, points: vec3[], stepCm: number = 25): number {
  const headingLength = Math.sqrt(heading.x * heading.x + heading.z * heading.z)
  if (headingLength < 1e-4) {
    return 180
  }
  const hx = heading.x / headingLength
  const hz = heading.z / headingLength

  let smallest = 180
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const edgeLength = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.z - a.z) * (b.z - a.z))
    const steps = Math.max(1, Math.ceil(edgeLength / stepCm))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const dx = a.x + (b.x - a.x) * t - eye.x
      const dz = a.z + (b.z - a.z) * t - eye.z
      const length = Math.sqrt(dx * dx + dz * dz)
      if (length < 1e-3) {
        return 0
      }
      const cosine = Math.max(-1, Math.min(1, (dx * hx + dz * hz) / length))
      const angle = (Math.acos(cosine) * 180) / Math.PI
      if (angle < smallest) {
        smallest = angle
      }
    }
  }
  return smallest
}
