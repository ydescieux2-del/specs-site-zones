/**
 * Done criterion 2.
 * Switching to the electrician, a path is on the ground from the truck to the work
 * area, and it stays visible the whole walk.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {PATH, WORK} from "../Scripts/SiteLayout"
import {FADE_MS, SiteZonesTestKit} from "./SiteZonesTestKit"

@component
export class ElectricianPathScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const kit = new SiteZonesTestKit()
    await kit.standAt(0, 0, 0, -1)

    // The supervisor does not see the path.
    await kit.switchTo("supervisor")
    expect(kit.report().pathVisible, "the path is not part of the supervisor's view").toBe(false)

    await kit.switchTo("electrician")
    await sleep(300)
    const chevrons = findSceneObjectByName("PathChevrons")
    expect(isNull(chevrons), "the path exists").toBe(false)
    expect(kit.report().pathVisible, "the path shows for the electrician").toBe(true)
    expect(chevrons.enabled).toBe(true)

    // It runs on the ground from the truck to the work area, as one unbroken line of chevrons.
    const visual = chevrons.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    expect(isNull(visual.mesh), "the chevrons have a mesh to draw").toBe(false)
    const centers = kit.report().pathChevrons.map((center) => kit.toSite(center))
    const first = PATH[0]
    const last = PATH[PATH.length - 1]
    const start = new vec3(first[0] * 100, 0, -first[1] * 100)
    const end = new vec3(last[0] * 100, 0, -last[1] * 100)
    expect(flatDistance(centers[0], start), "the path starts at the truck").toBeLessThan(60)
    expect(flatDistance(centers[centers.length - 1], end), "the path reaches the end of the route").toBeLessThan(60)
    let length = 0
    for (let i = 0; i < centers.length; i++) {
      expect(centers[i].y, "each chevron is raised just off the floor").toBeGreaterThan(0.5)
      expect(centers[i].y, "but only just").toBeLessThan(5)
      if (i > 0) {
        const gap = flatDistance(centers[i], centers[i - 1])
        expect(gap, "no gap in the line of chevrons").toBeLessThan(70)
        length += gap
      }
    }
    expect(length, "the path is about 32 m long").toBeGreaterThan(2900)
    expect(length).toBeLessThan(3400)
    const endToWork = Math.sqrt((last[0] - WORK.x) ** 2 + (last[1] - WORK.y) ** 2) * 100
    expect(endToWork, "the route ends at the work area").toBeLessThan(150)

    // The work area marker is not shown from the truck.
    expect(kit.report().workAreaOpacity, "the work area marker is hidden from the truck").toBeLessThan(0.05)

    // Walk the whole route. The path must be showing at every step.
    for (let i = 0; i < PATH.length; i++) {
      const [x, y] = PATH[i]
      const next = PATH[Math.min(i + 1, PATH.length - 1)]
      const headingX = i < PATH.length - 1 ? next[0] - x : x - PATH[i - 1][0]
      const headingZ = i < PATH.length - 1 ? -(next[1] - y) : -(y - PATH[i - 1][1])
      await kit.walkTo(x * 100, -y * 100, headingX, headingZ, 100)
      expect(kit.report().pathVisible, `the path still shows at waypoint ${i}`).toBe(true)
      expect(chevrons.enabled, `the chevrons are still drawn at waypoint ${i}`).toBe(true)
    }

    // At the end of the path the work area marker has appeared, with its label.
    await sleep(FADE_MS)
    expect(kit.report().workAreaOpacity, "the work area marker appears near the end of the path").toBeGreaterThan(0.95)
    const label = findSceneObjectByName("WorkAreaLabel")
    expect((label.getComponent("Component.Text") as Text).text).toBe("Your work area")
  }
}

function flatDistance(a: vec3, b: vec3): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2)
}
