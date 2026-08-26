import * as React from "react";
/**
 * Tap-to-place prompt pill, shown only while a mobile AR asset awaits placement.
 * Position-agnostic (it lays out no absolute position of its own) so the
 * embedding host controls placement.
 *
 * StudioSceneNavigator renders this by default (see its `placementIndicator`
 * prop). Hosts with their own top-of-screen chrome can set that prop to false
 * and render this where it fits, or build a custom UI from useStudioPlacement().
 */
export declare function StudioPlacementIndicator(): React.JSX.Element | null;
