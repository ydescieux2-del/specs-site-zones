/**
 * Not a test. It sets the scene for looking at the Lens or recording it: as the
 * supervisor it marks both floor openings and the crane's swing area through the
 * panel, then switches to the chosen view and stands the wearer at a chosen spot.
 * The Lens stays in that state when the scenario ends.
 *
 * Parameters (set them in the LEAF panel):
 *   role     "electrician" or "supervisor"
 *   x, z     where the wearer stands, in site centimeters (the truck is 0, 0; forward is -z)
 *   hx, hz   the floor direction he faces
 *   pitch    degrees he looks down (positive) or up (negative)
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {findSceneObjectByName, nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CRANE} from "../Scripts/SiteLayout"
import {FADE_MS, gapOutline, SiteZonesTestKit} from "./SiteZonesTestKit"

@component
export class StageDemoScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const text = (key: string, fallback: string): string => config?.get(key) ?? fallback
    const number = (key: string, fallback: number): number => {
      const parsed = parseFloat(text(key, String(fallback)))
      return isNaN(parsed) ? fallback : parsed
    }

    await sleep(1500)
    const kit = new SiteZonesTestKit()
    await kit.standAt(0, 0, 0, -1)
    await kit.switchTo("supervisor")

    await kit.markZone("floor", gapOutline(0))
    await kit.markZone("floor", gapOutline(1))

    // The crane's swing area as an eight-sided outline at the swing radius.
    const cx = CRANE.x * 100
    const cz = -CRANE.y * 100
    const r = CRANE.swingR * 100
    const swing: vec2[] = []
    for (let i = 0; i < 8; i++) {
      const angle = ((i + 0.5) / 8) * Math.PI * 2
      swing.push(new vec2(cx + Math.cos(angle) * r, cz + Math.sin(angle) * r))
    }
    await kit.markZone("crane", swing)

    const role = text("role", "electrician") === "supervisor" ? "supervisor" : "electrician"
    await kit.switchTo(role)
    await kit.standAt(number("x", 0), number("z", 0), number("hx", 0), number("hz", -1))

    const pitch = number("pitch", 0)
    if (pitch !== 0) {
      const rig = findSceneObjectByName("WearerRig").getTransform()
      const camera = findSceneObjectByName("Camera Object").getTransform()
      const eye = camera.getWorldPosition()
      // Looking down is a turn about the wearer's own right-hand axis.
      const tilt = quat.angleAxis((-pitch * Math.PI) / 180, camera.right)
      rig.setWorldRotation(tilt.multiply(rig.getWorldRotation()))
      await nextFrame()
      rig.setWorldPosition(rig.getWorldPosition().add(eye.sub(camera.getWorldPosition())))
    }
    await sleep(FADE_MS)
  }
}
