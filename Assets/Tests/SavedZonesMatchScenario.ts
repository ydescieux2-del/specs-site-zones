/**
 * Done criterion 5.
 * The zones the electrician sees are the ones the supervisor saved, in the same
 * places and at real size, and they stay put while I walk around.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CRANE} from "../Scripts/SiteLayout"
import {FADE_MS, gapOutline, largestCornerGap, SiteZonesTestKit} from "./SiteZonesTestKit"

@component
export class SavedZonesMatchScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const kit = new SiteZonesTestKit()
    await kit.standAt(0, 0, 0, -1)
    await kit.switchTo("supervisor")

    // The supervisor marks a floor opening and the crane's swing area.
    const floorOutline = gapOutline(0)
    const cx = CRANE.x * 100
    const cz = -CRANE.y * 100
    const r = CRANE.swingR * 100
    const craneOutline: vec2[] = []
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      craneOutline.push(new vec2(cx + Math.cos(angle) * r, cz + Math.sin(angle) * r))
    }
    const floorZone = await kit.markZone("floor", floorOutline)
    const craneZone = await kit.markZone("crane", craneOutline)

    // Where the supervisor's own markers ended up, in the world.
    const cases = [
      {saved: floorZone, drawn: floorOutline, type: "floor", label: "Floor opening"},
      {saved: craneZone, drawn: craneOutline, type: "crane", label: "Crane swing area"},
    ]
    const markerCorners = cases.map((entry) =>
      entry.drawn.map((_, index) =>
        findSceneObjectByName(`Zone${entry.saved.id}Marker_${index}`).getTransform().getWorldPosition(),
      ),
    )

    await kit.switchTo("electrician")
    expect(kit.report().zones.length, "the electrician has exactly the zones the supervisor saved").toBe(
      kit.main.savedZones().length,
    )

    const firstLook: vec3[][] = []
    for (let c = 0; c < cases.length; c++) {
      const entry = cases[c]
      const seen = kit.zone(entry.saved.id)
      expect(seen.type, "the zone keeps its hazard type").toBe(entry.type)
      expect(seen.corners.length, "the zone keeps all its corners").toBe(entry.drawn.length)

      // Same places: the electrician's outline passes through the supervisor's markers.
      expect(largestCornerGap(seen.corners, markerCorners[c]), "each corner is where the supervisor's marker is").toBeLessThan(1)
      expect(largestCornerGap(seen.corners, entry.saved.corners), "and matches the saved zone").toBeLessThan(0.5)

      // Real size: every edge is as long as the distance between the points the supervisor pinched.
      for (let i = 0; i < entry.drawn.length; i++) {
        const a = entry.drawn[i]
        const b = entry.drawn[(i + 1) % entry.drawn.length]
        const pinched = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
        const shown = seen.corners[i].distance(seen.corners[(i + 1) % seen.corners.length])
        expect(Math.abs(shown - pinched), `edge ${i} is drawn at real size`).toBeLessThan(2)
      }
      const visual = findSceneObjectByName(`ElectricianZone_${entry.saved.id}`)
      const scale = visual.getTransform().getWorldScale()
      expect(Math.abs(scale.x - 1) + Math.abs(scale.y - 1) + Math.abs(scale.z - 1), "nothing rescales the zone").toBeLessThan(0.001)

      // On the floor.
      for (const corner of seen.corners) {
        expect(Math.abs(kit.toSite(corner).y), "the zone lies on the floor").toBeLessThan(0.5)
      }
      firstLook.push(seen.corners)
    }

    // Walk around and turn. The zones must not move in the world.
    const stops: [number, number, number, number][] = [
      [0, -650, 0, -1],
      [60, -1050, 1, 0],
      [-60, -1450, -1, -1],
      [-200, -1720, 0, 1],
      [300, -500, 1, -1],
      [0, 0, 0, -1],
    ]
    for (const [x, z, headingX, headingZ] of stops) {
      await kit.walkTo(x, z, headingX, headingZ, 120)
      await sleep(200)
      for (let c = 0; c < cases.length; c++) {
        const seen = kit.zone(cases[c].saved.id)
        expect(largestCornerGap(seen.corners, firstLook[c]), `the zone stays put with the wearer at (${x}, ${z})`).toBeLessThan(0.1)
        expect(largestCornerGap(seen.corners, markerCorners[c]), "and is still where the supervisor marked it").toBeLessThan(1)
      }
    }

    // Close to each zone, what shows is that zone with its own label.
    await kit.walkTo(0, -900, 0, -1, 120)
    await sleep(FADE_MS)
    expect(kit.zone(floorZone.id).opacity, "the floor opening zone shows when he is near it").toBeGreaterThan(0.95)
    const floorSign = findSceneObjectByName(`ElectricianZone_${floorZone.id}`)
    expect(signLine(floorSign)).toBe("Floor opening")

    await kit.walkTo(200, -1100, 1, 0, 120)
    await sleep(FADE_MS)
    expect(kit.zone(craneZone.id).opacity, "the crane zone shows when he is near it").toBeGreaterThan(0.95)
    const craneSign = findSceneObjectByName(`ElectricianZone_${craneZone.id}`)
    expect(signLine(craneSign)).toBe("Crane swing area")

    // Back in the supervisor's view, the saved zones are unchanged.
    await kit.standAt(0, 0, 0, -1)
    await kit.switchTo("supervisor")
    const after = kit.main.savedZones()
    expect(largestCornerGap(after.find((zone) => zone.id === floorZone.id).corners, floorZone.corners)).toBeLessThan(0.1)
    expect(largestCornerGap(after.find((zone) => zone.id === craneZone.id).corners, craneZone.corners)).toBeLessThan(0.1)
  }
}

function signLine(zoneVisual: SceneObject): string {
  for (let i = 0; i < zoneVisual.getChildrenCount(); i++) {
    const sign = zoneVisual.getChild(i)
    if (sign.name !== "DangerSign") {
      continue
    }
    for (let j = 0; j < sign.getChildrenCount(); j++) {
      if (sign.getChild(j).name === "SignBodyText") {
        return (sign.getChild(j).getComponent("Component.Text") as Text).text
      }
    }
  }
  throw new Error(`"${zoneVisual.name}" has no Danger sign text.`)
}
