import { useSyncExternalStore } from "react";
import type { StudioColocationState } from "./colocation/types";
import { studioColocationStore } from "./domain/colocationStore";

const IDLE: StudioColocationState = { status: "idle" };

const subscribe = (onChange: () => void) =>
  studioColocationStore.subscribe(onChange);

/**
 * Subscribe to the shared session StudioSceneNavigator is running (its
 * `colocation` prop). Hosts build their own co-location UI with this, or render
 * <StudioColocationIndicator /> in their own chrome. The server snapshot is idle:
 * see the note in useStudioPlacement.
 */
export function useStudioColocation(): StudioColocationState {
  return useSyncExternalStore(
    subscribe,
    () => studioColocationStore.getState(),
    () => IDLE
  );
}
