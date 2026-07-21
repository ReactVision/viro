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
  const isPlacing = useSyncExternalStore(subscribe, () =>
    studioPlacementBannerStore.isActive()
  );
  const name = useSyncExternalStore(subscribe, () =>
    studioPlacementBannerStore.name()
  );
  const showMiss = useSyncExternalStore(subscribe, () =>
    studioPlacementBannerStore.showMiss()
  );
  return { isPlacing, name, showMiss };
}
