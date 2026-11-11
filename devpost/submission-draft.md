# Devpost entry text

## Name
Site Zones

## Tagline
The first-day worker sees the danger zones on the ground before he walks into one.

## Description
Every year construction workers are killed by hazards that a first-day worker has no way to know about: a crane's swing area, an opening in a floor. In 2023, 1,075 construction workers died in the US. Falls were 421 of those (39%), and struck-by and caught-in incidents were at least 111 (Maryland Occupational Safety and Health, from BLS figures).

Site Zones puts the hazard boundaries where they belong, on the ground, at real size.

A site supervisor wearing the glasses marks a zone: pinch Start Zone, pinch the ground to drop corner markers, drag them into place, pick the hazard type, save. Crane swing areas and floor openings can each be marked.

An electrician arriving for the first time puts on his glasses at his truck and a path appears on the ground to his work area. As he walks, each zone appears when he gets within 5 m of its edge, with a Danger sign standing inside it, facing him: yellow on approach, red at the edge. If he drifts toward a zone while looking somewhere else, a loud beep sounds and an arrow at the edge of his view points to the danger. Both stop when he looks at the zone or moves away.

Why glasses: a site map on a phone shows where the crane is, but it cannot put the edge of the swing area on the ground in front of him. He is walking and carrying gear, and looking down at a phone near a floor opening is itself the hazard. The beep and the arrow reach him when he is looking the wrong way, which a sign or a map cannot do.

Site Zones reinforces the physical barriers, covers and signs that OSHA requires. It does not replace them. Zone wording and colors follow 29 CFR 1926.200, the crane zone follows 1926.1424, and the floor-opening zones follow 1926.501 and 1926.502.

## How it was tested
Five LEAF scenarios, one per done criterion, drive the Lens in Lens Studio's preview the way a person would: pinching buttons and the ground, dragging markers, walking and turning the wearer. All five pass. What needs real glasses and is not claimed: beep loudness on a noisy site, path readability in daylight, and how a real hand pinch feels at floor distance.

## What is a stand-in
No SPECS device was available. The job site is a model built in Blender for the preview, and a Supervisor / Electrician switch stands in for two people wearing their own glasses. Zones are shared between the two views inside one Lens and are not kept after it closes.

## Built with
Lens Studio 5.24, Spectacles Interaction Kit, Spectacles UI Kit, LEAF, Blender, Claude Code (AI coding assistant).

## Disclosures
- New Lens built for this round. No code from the earlier round's Lens (ParSight) is used.
- AI assistance: Claude Code was used to write the Lens scripts, the LEAF tests and the stand-in site generator. Von Descieux made the design decisions in the design brief and reviewed the Lens in preview.
- Narration in the demo video is an AI voice (ElevenLabs).
- The Lens does not record, identify or follow people.
- The glasses are not rated safety eyewear.

## Video (1:58, narrated)
Narration is an AI voice (ElevenLabs, voice "Brian"). The script below is the shot list; the spoken lines are in `~/site-zones-video/build_video.py` and match the captions.

### Shot list
| Time | On screen | Caption |
|---|---|---|
| 0:00 to 0:08 | Title card | Site Zones. Danger zones on the ground, before you walk into them. |
| 0:08 to 0:16 | Establishing shot of the site | 1,075 construction workers died in the US in 2023. Falls were 421 of them. |
| 0:16 to 0:55 | Supervisor marks the two floor openings and the crane area | A supervisor marks each hazard: pinch the ground, drag the corners, save. |
| 0:55 to 1:05 | Switch to Electrician at the truck | A first-day electrician puts on his glasses at his truck. |
| 1:05 to 1:30 | Walking the path, zones appearing | A path leads to his work area. Zones appear as he gets close, with a Danger sign facing him. |
| 1:30 to 1:50 | Drifts toward the floor opening, beep, arrow, then looks at it | If he drifts toward one while looking away: a beep and an arrow. Looking at it stops both. |
| 1:50 to 2:05 | Arrives at the work area | His work area, reached without a surprise. |
| 2:05 to 2:15 | End card | Site Zones reinforces the barriers, covers and signs OSHA requires. It does not replace them. |
