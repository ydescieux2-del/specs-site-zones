/**
 * Done criterion 4.
 * When I walk toward a zone while looking away from it, a loud beep sounds and an
 * arrow points to the danger. They stop when I turn to look at it or back away.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {gapOutline, SiteZonesTestKit} from "./SiteZonesTestKit"

const REACT_MS = 300

@component
export class LookAwayWarningScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const kit = new SiteZonesTestKit()
    await kit.standAt(0, 0, 0, -1)

    // The supervisor marks the first floor opening. The zone's near edge is at x = -230.
    await kit.switchTo("supervisor")
    const saved = await kit.markZone("floor", gapOutline(0))

    await kit.switchTo("electrician")
    const beep = findSceneObjectByName("WarningBeep").getComponent("Component.AudioComponent") as AudioComponent
    const arrow = findSceneObjectByName("DangerArrow")

    // On the path beside the zone, 2.3 m from it: close, but not close enough to warn.
    await kit.walkTo(0, -900, 0, -1)
    await sleep(REACT_MS)
    this.expectQuiet(kit, beep, arrow, "more than 2 m away and looking ahead")

    // Drift toward it while still looking ahead. The zone is on his left, out of view.
    await kit.walkTo(-100, -900, 0, -1, 25)
    await sleep(REACT_MS)
    let report = kit.report()
    expect(kit.zone(saved.id).distanceCm, "he is within 2 m of the zone").toBeLessThan(200)
    expect(report.warning, "drifting toward a zone he is not looking at raises the warning").toBe(true)
    expect(report.warningZoneId, "the warning is about that zone").toBe(saved.id)
    expect(report.beeping, "the beep sounds").toBe(true)
    expect(beep.isPlaying(), "the beep is actually playing").toBe(true)
    expect(beep.volume, "the beep is at full volume").toBeGreaterThan(0.9)
    expect(report.arrowVisible, "the arrow shows").toBe(true)
    expect(arrow.enabled).toBe(true)
    expect(report.arrowDirection.x, "the arrow points left, toward the zone").toBeLessThan(-0.7)
    const arrowLocal = arrow.getTransform().getLocalPosition()
    expect(arrowLocal.x, "the arrow sits toward the left edge of his view").toBeLessThan(-10)
    expect(Math.abs(arrowLocal.z + 100), "the arrow is about 1 m ahead").toBeLessThan(5)

    // He turns to look at the zone: both stop.
    await kit.standAt(-100, -900, -1, 0)
    await sleep(REACT_MS)
    this.expectQuiet(kit, beep, arrow, "looking at the zone")

    // He looks away again: both come back.
    await kit.standAt(-100, -900, 0, -1)
    await sleep(REACT_MS)
    expect(kit.report().warning, "looking away again brings the warning back").toBe(true)
    expect(beep.isPlaying()).toBe(true)
    expect(arrow.enabled).toBe(true)

    // Facing the other way puts the zone on his right, and the arrow follows.
    await kit.standAt(-100, -900, 0, 1)
    await sleep(REACT_MS)
    expect(kit.report().arrowDirection.x, "the arrow points right when the zone is on his right").toBeGreaterThan(0.7)

    // He backs away, still not looking at it: both stop.
    await kit.walkTo(40, -900, 0, 1, 25)
    await sleep(REACT_MS)
    expect(kit.zone(saved.id).distanceCm, "he is more than 2 m from the zone").toBeGreaterThan(220)
    this.expectQuiet(kit, beep, arrow, "backed away")

    // Walking toward it while looking straight at it does not beep outside the zone.
    await kit.walkTo(-150, -900, -1, 0, 25)
    await sleep(REACT_MS)
    this.expectQuiet(kit, beep, arrow, "close but looking at it")

    // Stepping inside: the beep repeats until he steps out, even though he is looking at it.
    await kit.walkTo(-400, -900, -1, 0, 25)
    await sleep(REACT_MS)
    expect(kit.zone(saved.id).distanceCm, "he is inside the zone").toBeLessThan(0)
    expect(kit.report().beeping, "inside a zone the beep sounds").toBe(true)
    expect(beep.isPlaying()).toBe(true)
    await sleep(1200)
    expect(beep.isPlaying(), "the beep keeps repeating while he is inside").toBe(true)

    await kit.walkTo(-150, -900, -1, 0, 25)
    await sleep(REACT_MS)
    this.expectQuiet(kit, beep, arrow, "stepped out and looking at it")

    // The supervisor's view has no warnings, even standing at the zone looking away.
    await kit.standAt(-100, -900, 0, -1)
    await sleep(REACT_MS)
    expect(kit.report().warning).toBe(true)
    await kit.standAt(0, 0, 0, -1)
    await kit.switchTo("supervisor")
    await kit.standAt(-100, -900, 0, -1)
    await sleep(REACT_MS)
    this.expectQuiet(kit, beep, arrow, "in the supervisor's view")
  }

  private expectQuiet(kit: SiteZonesTestKit, beep: AudioComponent, arrow: SceneObject, when: string): void {
    const report = kit.report()
    expect(report.warning, `no warning when ${when}`).toBe(false)
    expect(report.beeping, `no beep when ${when}`).toBe(false)
    expect(beep.isPlaying(), `the beep is silent when ${when}`).toBe(false)
    expect(report.arrowVisible, `no arrow when ${when}`).toBe(false)
    expect(arrow.enabled, `the arrow is hidden when ${when}`).toBe(false)
  }
}
