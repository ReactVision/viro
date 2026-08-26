import { useSyncExternalStore } from "react";
import { studioPlacementBannerStore } from "./domain/placementBannerStore";

const subscribe = (onChange: () => void) =>
  studioPlacementBannerStore.subscribe(onChange);

/**
 * Subscribe to the mobile tap-to-place prompt state. Hosts render their own
 * placement indicator with this, positioning it in their own layout / safe-area
 * insets (viro can't see host chrome, so it can't place an overlay relative to
 * it). `name` is the asset awaiting placement; `showMiss` flags a missed tap.
 */
export function useStudioPlacement(): {
  isPlacing: boolean;
  name: string | null;
  showMiss: boolean;
} {
  // The third argument is the server snapshot. Without it useSyncExternalStore
  // throws outright in any server-rendering context, which the web platform can
  // plausibly be -- and the store is a client-side thing, so the honest server
  // answer is "nothing is being placed" rather than a guess.
  const isPlacing = useSyncExternalStore(
    subscribe,
    () => studioPlacementBannerStore.isActive(),
    () => false
  );
  const name = useSyncExternalStore(
    subscribe,
    () => studioPlacementBannerStore.name(),
    () => null
  );
  const showMiss = useSyncExternalStore(
    subscribe,
    () => studioPlacementBannerStore.showMiss(),
    () => false
  );
  return { isPlacing, name, showMiss };
}
