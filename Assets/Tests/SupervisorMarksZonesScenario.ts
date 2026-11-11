/**
 * Done criterion 1.
 * As the supervisor, I pinch Start Zone, pinch the ground to drop three or more
 * corner markers, and an outline joins them. Dragging a marker changes the shape.
 * Save keeps the zone, and I can make a second and third one.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, findSceneObjectsByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CRANE} from "../Scripts/SiteLayout"
import {gapOutline, largestCornerGap, SiteZonesTestKit} from "./SiteZonesTestKit"

@component
export class SupervisorMarksZonesScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500) // let SIK, the panels and the tool finish starting
    const kit = new SiteZonesTestKit()
    await kit.standAt(0, 0, 0, -1)
    await kit.switchTo("supervisor")

    const savedBefore = kit.main.savedZones().length

    // Start Zone, then three corners around the first floor opening.
    await kit.pinch("StartZoneButton")
    expect(kit.main.supervisorStatus().drafting, "Start Zone should begin a zone").toBe(true)
    expect(kit.main.supervisorStatus().corners, "a new zone starts with no corners").toBe(0)

    const outline = gapOutline(0)
    for (let i = 0; i < 3; i++) {
      await kit.pinchGround(outline[i].x, outline[i].y)
      expect(kit.main.supervisorStatus().corners, "each pinch on the ground drops one corner").toBe(i + 1)
      const marker = findSceneObjectByName(`DraftMarker_${i}`)
      expect(isNull(marker), `corner marker ${i} should exist`).toBe(false)
      const where = kit.toSite(marker.getTransform().getWorldPosition())
      expect(Math.abs(where.x - outline[i].x), "the marker lands where the ground was pinched (x)").toBeLessThan(2)
      expect(Math.abs(where.z - outline[i].y), "the marker lands where the ground was pinched (z)").toBeLessThan(2)
      expect(Math.abs(where.y), "the marker sits on the floor").toBeLessThan(1)
    }

    // With three corners an outline joins them, with a fill inside.
    const draft = findSceneObjectByName("DraftZone")
    expect(childNamed(draft, "ZoneOutline").enabled, "an outline joins the corners").toBe(true)
    expect(childNamed(draft, "ZoneFill").enabled, "three corners close into a filled zone").toBe(true)
    expect(kit.main.draftCorners().length, "the outline passes through all three corners").toBe(3)

    // A fourth corner extends the outline.
    await kit.pinchGround(outline[3].x, outline[3].y)
    expect(kit.main.draftCorners().length, "the outline passes through all four corners").toBe(4)

    // Dragging a marker changes the shape.
    const dragged = findSceneObjectByName("DraftMarker_1")
    const beforeDrag = dragged.getTransform().getWorldPosition()
    const cornersBeforeDrag = kit.main.draftCorners()
    await kit.dragMarker("DraftMarker_1", new vec3(2.5, 0, 0), 700)
    const afterDrag = dragged.getTransform().getWorldPosition()
    expect(afterDrag.x - beforeDrag.x, "the marker follows the drag along the floor").toBeGreaterThan(20)
    expect(Math.abs(afterDrag.y - beforeDrag.y), "the marker stays on the floor while dragged").toBeLessThan(0.5)
    const cornersAfterDrag = kit.main.draftCorners()
    expect(cornersAfterDrag[1].distance(afterDrag), "the outline's corner moves with the marker").toBeLessThan(1)
    expect(cornersAfterDrag[1].distance(cornersBeforeDrag[1]), "the shape changed").toBeGreaterThan(20)
    expect(cornersAfterDrag[0].distance(cornersBeforeDrag[0]), "the other corners stay put").toBeLessThan(0.5)

    // Clear last removes the newest corner; put it back.
    await kit.pinch("ClearLastButton")
    expect(kit.main.supervisorStatus().corners, "Clear last removes one corner").toBe(3)
    await kit.pinchGround(outline[3].x, outline[3].y)
    expect(kit.main.supervisorStatus().corners).toBe(4)

    // Save keeps the zone.
    await kit.pinch("FloorTypeButton")
    await kit.pinch("SaveButton")
    let saved = kit.main.savedZones()
    expect(saved.length - savedBefore, "Save keeps the zone").toBe(1)
    expect(kit.main.supervisorStatus().drafting, "after Save the tool is ready for another zone").toBe(false)
    const first = saved[saved.length - 1]
    expect(first.type).toBe("floor")
    expect(first.corners.length).toBe(4)
    expect(largestCornerGap(first.corners, cornersAfterDrag), "the saved zone has the shape that was drawn").toBeLessThan(1)

    // A second zone, around the other floor opening.
    const second = await kit.markZone("floor", gapOutline(1))
    expect(second.id === first.id, "the second zone is a new zone").toBe(false)

    // A third zone, around the crane's swing area.
    const cx = CRANE.x * 100
    const cz = -CRANE.y * 100
    const r = CRANE.swingR * 100
    const third = await kit.markZone("crane", [
      new vec2(cx - r, cz + r),
      new vec2(cx + r, cz + r),
      new vec2(cx + r, cz - r),
      new vec2(cx - r, cz - r),
    ])
    expect(third.type).toBe("crane")

    saved = kit.main.savedZones()
    expect(saved.length - savedBefore, "three zones are kept").toBe(3)
    expect(largestCornerGap(saved[saved.length - 3].corners, first.corners), "earlier zones are unchanged by later ones").toBeLessThan(0.5)

    // All saved zones and their markers stay visible to the supervisor.
    for (const zone of [first, second, third]) {
      const visual = findSceneObjectByName(`SavedZone_${zone.id}`)
      expect(childNamed(visual, "ZoneOutline").enabled, "a saved zone keeps its outline").toBe(true)
      expect(findSceneObjectsByName(`Zone${zone.id}Marker_0`).length, "a saved zone keeps its markers").toBe(1)
    }
  }
}

function childNamed(parent: SceneObject, name: string): SceneObject {
  for (let i = 0; i < parent.getChildrenCount(); i++) {
    if (parent.getChild(i).name === name) {
      return parent.getChild(i)
    }
  }
  throw new Error(`"${parent.name}" has no child named "${name}".`)
}
