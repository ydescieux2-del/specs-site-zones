/**
 * Layout of the stand-in job site, mirrored from tools/site/build_site.py.
 *
 * build_site.py works in meters with x to the right and y forward from the truck.
 * The Lens works in centimeters in the SiteWorld frame: x to the right, y up from
 * the floor, and the wearer walks toward -z. So a site point (x, y) in meters is
 * (x * 100, 0, -y * 100) here. If the constants change in build_site.py, change
 * them here too.
 */

/** Converts a build_site.py ground point in meters to SiteWorld centimeters. */
export function sitePoint(xMeters: number, yMeters: number): vec3 {
  return new vec3(xMeters * 100, 0, -yMeters * 100)
}

/** Floor slab extents in meters (x0..x1 across, y0..y1 forward). */
export const SLAB = {x0: -11.0, x1: 15.0, y0: -5.0, y1: 23.0}

/** The two floor openings: center and size in meters. */
export const GAPS = [
  {x: -4.0, y: 9.0, w: 2.2, d: 2.2},
  {x: 3.2, y: 14.0, w: 1.6, d: 3.0},
]

/** Crane center and the radius its rotating upper section sweeps, in meters. */
export const CRANE = {x: 9.0, y: 11.0, swingR: 5.0}

/** The electrician's work area in meters. */
export const WORK = {x: -2.0, y: 18.0}

/** Waypoints of the pre-laid route from the truck to the work area, in meters. */
export const PATH: [number, number][] = [
  [0.0, 0.5],
  [0.0, 6.5],
  [0.6, 10.5],
  [-0.6, 14.5],
  [-2.0, 17.2],
]

/** Name of the node in JobSite.glb that the Lens rotates to swing the crane. */
export const CRANE_UPPER_NODE = "CraneUpper"

/** The route as SiteWorld points. */
export function pathPoints(): vec3[] {
  return PATH.map(([x, y]) => sitePoint(x, y))
}

/** Slab bounds in SiteWorld centimeters, used to keep corner markers on the floor. */
export function slabBounds(): {minX: number; maxX: number; minZ: number; maxZ: number} {
  return {
    minX: SLAB.x0 * 100,
    maxX: SLAB.x1 * 100,
    minZ: -SLAB.y1 * 100,
    maxZ: -SLAB.y0 * 100,
  }
}
