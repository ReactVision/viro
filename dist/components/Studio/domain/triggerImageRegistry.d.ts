import { StudioAsset } from "../types";
/**
 * Registers image tracking targets and returns the asset id -> target name map
 * the ViroARImageMarkers mount against. Must be called before rendering them.
 *
 * Placements asking for the same picture at the same orientation and physical
 * width share one target, where this used to register one per placement and
 * hand every marker the last name it had generated. Both halves of that were
 * wrong: the extra targets each downloaded and decoded their own copy of the
 * image and no marker could reach them, and pointing several markers at one
 * target renders only one of them, since the renderer attaches a detected
 * anchor to a single marker node and leaves the rest waiting for an anchor that
 * never comes. Orientation and physical width stay part of the key rather than
 * being folded away: they describe how the file relates to the print, so two
 * placements that disagree are asking for two reference images, and the caller
 * groups its markers by target name to put the sharers on one.
 */
export declare function registerTriggerImageTargets(assets: StudioAsset[]): Map<string, string>;
/**
 * Cleans up trigger image targets when the scene unmounts.
 */
export declare function cleanupTriggerImageTargets(targetNames: string[]): void;
