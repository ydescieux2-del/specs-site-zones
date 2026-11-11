# Site Zones

A Lens for Snap Spectacles (SPECS) that shows a first-day construction worker where the danger zones are, before he walks into one.

- A **supervisor** marks no-go zones on the ground: around a crane's swing area and around openings in a floor.
- An **electrician** arriving at the site sees a path from his truck to his work area. As he gets near a zone, its outline and a Danger sign appear in the zone, facing him. If he drifts toward a zone while looking somewhere else, a loud beep sounds and an arrow points to the danger.

The Lens **reinforces** the physical barriers, covers and signs that OSHA requires on a site. It does not replace them. The zone wording and colors follow 29 CFR 1926.200; the crane and floor-opening zones follow 1926.1424 and 1926.501. Sources are in [`devpost/standards-baseline.md`](devpost/standards-baseline.md).

Built for the Learn AR with SPECS hackathon. The design brief is in [`devpost/design-brief.md`](devpost/design-brief.md).

## Run it

Needs Lens Studio 5.24 or later.

1. Open `specs-site-zones.esproj` in Lens Studio.
2. In the Preview panel, use the SPECS device in Interactive mode.
3. Walk with W A S D, go down and up with Q and E, look with right-drag (or hold Shift), and click to pinch.
4. As the supervisor: pinch **Start Zone**, pinch the ground to drop corner markers, drag a marker to adjust, pick **Crane swing area** or **Floor opening**, pinch **Save**.
5. Pinch **Electrician** on the switch panel at the truck, then follow the green chevrons.

## What is a stand-in

No SPECS device was available, so these are stand-ins and are labeled in the scene:

- `JobSite [stand-in]` is a model of a high-rise ground floor under construction, built by `tools/site/build_site.py` in Blender. The crane's upper section swings as an animation.
- The **Supervisor / Electrician** switch stands in for two people wearing their own glasses. Zones are shared between the two views inside one Lens, not between devices.
- Zones are kept only while the Lens runs.

## Tests

LEAF (Lens Studio's integration test framework) scenarios in `Assets/Tests` check each done criterion in the design brief, driving the Lens the way a person would (pinching buttons and the ground, dragging markers, walking and turning the wearer):

| Scenario | Done criterion |
|---|---|
| `criterion-1-supervisor-marks-zones` | Start, drop corners, drag a marker, Save, three zones |
| `criterion-2-electrician-path` | Path from the truck to the work area, visible the whole walk |
| `criterion-3-zones-appear-near` | Hidden from the truck, appear within 5 m with a Danger sign facing him, fade on leaving |
| `criterion-4-look-away-warning` | Beep and arrow when drifting toward a zone he is not looking at |
| `criterion-5-saved-zones-match` | The electrician sees the saved zones, same places, real size |

Open the LEAF panel in Lens Studio and run them one at a time. Two more scenarios are not tests: `stage-demo` sets up the three hazards and places the wearer, and `guided-tour` plays the whole flow at walking pace.

These tests prove the logic in preview. How loud the beep is on a noisy site, how readable the path is in daylight, and how a real hand pinch feels at floor distance need real glasses.

## Layout

- `Assets/Scripts`: the Lens. `SiteZonesMain.ts` is the entry point.
- `Assets/Tests`: the LEAF scenarios.
- `tools/site`, `tools/sfx`: scripts that generate the stand-in site and the warning beep.
- `devpost`: the design brief and the standards research.

## Packages

Spectacles Interaction Kit 2.0 and UI Kit 2.0 (Lens Studio base template), LEAF 2.0.2.
