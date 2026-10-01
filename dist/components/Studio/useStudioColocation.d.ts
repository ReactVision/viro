import type { StudioColocationState } from "./colocation/types";
/**
 * Subscribe to the shared session StudioSceneNavigator is running (its
 * `colocation` prop). Hosts build their own co-location UI with this, or render
 * <StudioColocationIndicator /> in their own chrome. The server snapshot is idle:
 * see the note in useStudioPlacement.
 */
export declare function useStudioColocation(): StudioColocationState;
