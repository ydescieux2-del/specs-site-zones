---
status: approved
---

# Design brief: Site Zones (working title, default)

<!-- Filled in by plan-lens from the learner's interview, 2026-11-11. The learner's words are used where he gave them. Values marked (default) were not chosen by the learner. -->

## The one spatial moment
An electrician arrives at a high-rise construction site for the first time. At his truck he puts on his hard hat and glasses, and a path appears on the ground leading to the spot on the ground floor where he will be working. As he walks, the no-go zones around the crane and around gaps in the floor appear when he gets close, each with a Danger message standing in the zone itself. If he drifts toward one while looking somewhere else, a loud beep sounds and an arrow points to the danger.

Before that, a supervisor wearing the same glasses sets those zones up: he presses Start, pinches to drop corner markers on the ground, drags them into place, and saves.

## Who it's for
- **A worker entering a site for the first time**, here an electrician who needs to get from his truck to his work area without walking into a hazard he doesn't know is there.
- **The site supervisor**, who knows where the hazards are today and marks them.
- Why it matters: 1,075 construction workers died in the US in 2023. Falls were 421 of those (39%), and struck-by and caught-in incidents were at least 111 (Maryland Occupational Safety and Health, from BLS figures).

## Safety standards it lines up with
The learner asked that the Lens be built to support worksite safety standards. Details and sources are in `devpost/standards-baseline.md`.
- **Crane: 29 CFR 1926.1424, work area control.** Mark the boundary of the area where the rotating part of the crane could strike or crush someone, and train workers to recognize it. The crane zone is drawn at that boundary.
- **Floor gaps: 29 CFR 1926.501(b)(4) and 1926.502(i).** Holes need covers or guardrails. The floor-gap zones are drawn around the openings.
- **Signs: 29 CFR 1926.200.** Danger signs are red, black and white and are for immediate hazards; caution is yellow and black. The Lens uses the same wording and colors.
- The Lens reinforces these rules. It does not replace the physical barriers, covers and signs they require, and the entry must never say it does.

## Why it belongs on glasses
- Uses: draws in the world (the path and the zone edges sit on the ground at real size, where they apply), leaves your body free (hands on tools and eyes up while walking), shares your view (the warning depends on where he is and where he is looking).
- Why it's better than the phone or laptop version:
  - A site map on a phone shows where the crane is. It can't put the edge of the swing area on the ground in front of him.
  - He is walking and carrying gear. Looking down at a phone near a floor opening is itself the hazard.
  - The beep and arrow reach him when he is looking the wrong way, which a sign or a map cannot do.

## Product or overlay
- Type: overlay. It responds to a real site and real hazards.
- What the real version would sense: where the wearer is on the site and which way he is looking, and the zones the supervisor saved, shared to every worker's glasses.
- Stand-in for the preview:
  - The site is a virtual ground floor of a high-rise under construction, at real size: his truck at the start, a crane with a rotating upper section, two gaps in the floor slab (default: two), and his work area with an electrical panel at the end. No elevator; he works on the ground floor.
  - One preview shows both people. A "Supervisor / Electrician" switch stands in for two pairs of glasses (default: a small panel at the truck).
  - The route is a pre-laid path through the virtual site. It does not re-route itself around newly drawn zones (default).
  - The crane's rotation is an animation (default).

## Where things live
- Where the user is looking during the main task: at the ground a few meters ahead while walking (electrician); at the ground around the crane and the floor gaps (supervisor).
- Path: on the ground from the truck to the work area, about 18 m long (default), a line of light chevrons about 40 cm wide (default), raised just off the floor.
- Work area marker: a light outline on the ground at the end of the path with the label "Your work area" (default).
- Zone outline: on the ground, joining the supervisor's corner markers, with a light fill inside. Yellow when he is near, red when he is at the edge or inside (default, following the caution and danger colors in 1926.200).
- Danger message: inside the danger zone, at the edge nearest him, turned to face him, top at about chest height (default: 1.2 m), about 50 x 35 cm (default). The word DANGER on red with one short line under it, "Crane swing area" or "Floor opening" (default look, following the OSHA danger sign; the learner said a red exclamation point or stop-sign shape is also acceptable).
- Arrow: near the edge of his view, about 1 m ahead, pointing toward the danger (default placement).
- Supervisor panel: floats about 1 m in front of the supervisor, a little below eye level, and follows him (default). Buttons: Start Zone, Crane swing area, Floor opening, Save, Clear last (default set; the learner asked for a way to activate the function and a save).
- Corner markers: on the ground where he pinches, about 15 cm across (default), light colored, with a line joining each to the next.

## Hands and input
- Switch view: pinch "Supervisor" or "Electrician" on the switch panel.
- Supervisor, start: pinch Start Zone, then pinch the hazard type.
- Supervisor, mark: pinch the ground to drop a corner marker. Each new marker joins to the last. Three or more markers make a zone.
- Supervisor, adjust: grab a marker and drag it along the ground; the outline follows.
- Supervisor, finish: pinch Save. The zone is kept and he can start another, so he can mark the crane area and both floor gaps.
- Electrician: no hand input while walking. He only walks and looks.
- Targets are big and highlight when aimed at. All panels and buttons are light, because dark UI disappears on the additive display.
- Voice: none.

## When things show
- Path: always visible to the electrician, from the truck to the work area.
- Zones and their Danger messages: hidden when he is far away. They appear as he gets close (default: within 5 m of the zone edge) and fade again when he moves away.
- Zone color: yellow when it first appears, red when he is within 1 m of the edge or inside it (default).
- If he heads toward a zone he is not looking at (default: within 2 m of the edge and the zone more than about 20 degrees from the center of his view): a loud beep and an arrow pointing to the danger. Both stop when he looks at the zone or moves away. Inside a zone the beep repeats until he steps out (default).
- Supervisor view: all saved zones, markers and the panel are visible the whole time. The path and the warnings are not.
- Work area marker: appears when he is within 5 m of the end of the path (default).

## Done criteria
Each one can be checked in Lens Studio's preview.
1. As the supervisor, I pinch Start Zone, pinch the ground to drop three or more corner markers, and an outline joins them. Dragging a marker changes the shape. Save keeps the zone, and I can make a second and third one.
2. Switching to the electrician, a path is on the ground from the truck to the work area, and it stays visible the whole walk.
3. The zones are not visible from the truck. As I walk within about 5 m of one, its outline and a Danger message appear in the zone, facing me, and they fade when I walk away.
4. When I walk toward a zone while looking away from it, a loud beep sounds and an arrow points to the danger. They stop when I turn to look at it or back away.
5. The zones the electrician sees are the ones the supervisor saved, in the same places and at real size, and they stay put while I walk around.

## Out of scope
- An elevator and upper floors.
- Detecting real hazards, cranes or floor openings with the camera.
- Two people wearing glasses at once, and zones shared between devices.
- Zones remembered after the Lens is closed.
- Re-routing the path around a zone the supervisor draws across it.
- Tracing a zone with a fingertip (replaced by pinch-and-drag corner markers).
- Zones that expire on a timer.

## Risks and open questions
- The Lens supports the standards; it does not replace the barriers, covers and signs OSHA requires. All entry text and the video must say "reinforces", never "enforces" or "ensures compliance".
- Feel unproven without glasses: whether a loud beep is heard on a noisy site, how readable the path is in daylight on an additive display, and whether the narrow view (about 37 degrees tall by 32 degrees wide) shows enough ground ahead.
- The glasses are not rated safety eyewear.
- The crane zone in the preview is a fixed outline around an animated crane; a real swing area changes as the crane moves.
- Rules still to read before quoting them: 1926.1425 (clear of a suspended load) and 1926.21 (safety training).

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
