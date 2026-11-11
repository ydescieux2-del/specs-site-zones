/**
 * Done criterion 3.
 * The zones are not visible from the truck. As I walk within about 5 m of one, its
 * outline and a Danger message appear in the zone, facing me, and they fade when I
 * walk away.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {isInside, nearestOnOutline} from "../Scripts/ZoneMath"
import {FADE_MS, gapOutline, SiteZonesTestKit} from "./SiteZonesTestKit"

@component
export class ZonesAppearNearScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const kit = new SiteZonesTestKit()
    await kit.standAt(0, 0, 0, -1)

    // The supervisor marks the first floor opening.
    await kit.switchTo("supervisor")
    const outline = gapOutline(0)
    const saved = await kit.markZone("floor", outline)
    const sitePoints = outline.map((corner) => new vec3(corner.x, 0, corner.y))

    // From the truck, about 8 m from the zone, nothing shows.
    await kit.switchTo("electrician")
    await kit.standAt(0, 0, 0, -1)
    await sleep(FADE_MS)
    expect(kit.zone(saved.id).distanceCm, "the truck is more than 5 m from the zone").toBeGreaterThan(500)
    expect(kit.zone(saved.id).opacity, "the zone is not visible from the truck").toBeLessThan(0.02)
    const visual = findSceneObjectByName(`ElectricianZone_${saved.id}`)
    expect(childNamed(visual, "ZoneOutline").enabled, "its outline is not drawn from the truck").toBe(false)
    expect(childNamed(visual, "DangerSign").enabled, "its Danger message is not drawn from the truck").toBe(false)

    // Just outside 5 m it is still hidden.
    await kit.walkTo(0, -220, 0, -1)
    await sleep(FADE_MS)
    expect(kit.zone(saved.id).distanceCm).toBeGreaterThan(500)
    expect(kit.zone(saved.id).opacity, "the zone stays hidden outside 5 m").toBeLessThan(0.02)

    // Walk along the path to within 5 m: the outline and the Danger message appear.
    await kit.walkTo(0, -650, 0, -1)
    await sleep(FADE_MS)
    let seen = kit.zone(saved.id)
    expect(seen.distanceCm, "he is now within 5 m of the zone").toBeLessThan(500)
    expect(seen.opacity, "the zone has appeared").toBeGreaterThan(0.95)
    expect(seen.look, "a zone first appears in caution yellow").toBe("caution")
    expect(childNamed(visual, "ZoneOutline").enabled, "the outline is drawn").toBe(true)
    expect(childNamed(visual, "ZoneFill").enabled, "the light fill is drawn").toBe(true)

    const sign = childNamed(visual, "DangerSign")
    expect(sign.enabled, "the Danger message is drawn").toBe(true)
    expect(textOf(childNamed(sign, "SignHeaderText")), "it says DANGER").toBe("DANGER")
    expect(textOf(childNamed(sign, "SignBodyText")), "with the hazard under it").toBe("Floor opening")

    // The message stands in the zone, at the edge nearest him, facing him.
    const wearer = new vec3(0, 0, -650)
    const signSite = kit.toSite(seen.signPosition)
    expect(isInside(signSite, sitePoints), "the Danger message stands inside the zone").toBe(true)
    const nearestEdge = nearestOnOutline(wearer, sitePoints).point
    expect(
      Math.sqrt((signSite.x - nearestEdge.x) ** 2 + (signSite.z - nearestEdge.z) ** 2),
      "the Danger message is at the edge nearest him",
    ).toBeLessThan(60)
    const toWearer = new vec3(wearer.x - signSite.x, 0, wearer.z - signSite.z).normalize()
    expect(seen.signFacing.dot(toWearer), "the Danger message faces him").toBeGreaterThan(0.98)

    // Walk around to another side: the message moves to the nearest edge and still faces him.
    await kit.walkTo(-190, -900, -1, 0)
    await sleep(FADE_MS)
    seen = kit.zone(saved.id)
    expect(seen.look, "within 1 m of the edge the zone turns danger red").toBe("danger")
    const besideSign = kit.toSite(seen.signPosition)
    const beside = new vec3(-190, 0, -900)
    expect(isInside(besideSign, sitePoints)).toBe(true)
    const toBeside = new vec3(beside.x - besideSign.x, 0, beside.z - besideSign.z).normalize()
    expect(seen.signFacing.dot(toBeside), "the Danger message turns to keep facing him").toBeGreaterThan(0.98)

    // Walk away: the outline and the message fade out.
    await kit.walkTo(0, -650, 0, 1)
    await kit.walkTo(0, 0, 0, 1)
    await sleep(FADE_MS)
    expect(kit.zone(saved.id).opacity, "the zone fades when he walks away").toBeLessThan(0.02)
    expect(childNamed(visual, "ZoneOutline").enabled, "the outline is gone").toBe(false)
    expect(sign.enabled, "the Danger message is gone").toBe(false)
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

function textOf(object: SceneObject): string {
  return (object.getComponent("Component.Text") as Text).text
}
