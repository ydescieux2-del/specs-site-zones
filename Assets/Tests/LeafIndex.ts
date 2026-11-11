/**
 * Registers the Site Zones LEAF scenarios. There is one scenario per done
 * criterion in devpost/design-brief.md.
 */
import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {ElectricianPathScenario} from "./ElectricianPathScenario"
import {GuidedTourScenario} from "./GuidedTourScenario"
import {LookAwayWarningScenario} from "./LookAwayWarningScenario"
import {SavedZonesMatchScenario} from "./SavedZonesMatchScenario"
import {StageDemoScenario} from "./StageDemoScenario"
import {SupervisorMarksZonesScenario} from "./SupervisorMarksZonesScenario"
import {ZonesAppearNearScenario} from "./ZonesAppearNearScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "criterion-1-supervisor-marks-zones", typename: SupervisorMarksZonesScenario.getTypeName()},
    {id: "criterion-2-electrician-path", typename: ElectricianPathScenario.getTypeName()},
    {id: "criterion-3-zones-appear-near", typename: ZonesAppearNearScenario.getTypeName()},
    {id: "criterion-4-look-away-warning", typename: LookAwayWarningScenario.getTypeName()},
    {id: "criterion-5-saved-zones-match", typename: SavedZonesMatchScenario.getTypeName()},
    // Not a test: marks the three hazards and stands the wearer somewhere, for a look or a recording.
    {
      id: "stage-demo",
      typename: StageDemoScenario.getTypeName(),
      parameters: {role: "electrician", x: "0", z: "0", hx: "0", hz: "-1", pitch: "0"},
    },
    // Not a test: plays the whole flow at walking pace, to watch or record.
    {id: "guided-tour", typename: GuidedTourScenario.getTypeName()},
  ]
}
