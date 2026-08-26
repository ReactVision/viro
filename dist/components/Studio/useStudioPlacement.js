"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useStudioPlacement = useStudioPlacement;
const react_1 = require("react");
const placementBannerStore_1 = require("./domain/placementBannerStore");
const subscribe = (onChange) => placementBannerStore_1.studioPlacementBannerStore.subscribe(onChange);
/**
 * Subscribe to the mobile tap-to-place prompt state. Hosts render their own
 * placement indicator with this, positioning it in their own layout / safe-area
 * insets (viro can't see host chrome, so it can't place an overlay relative to
 * it). `name` is the asset awaiting placement; `showMiss` flags a missed tap.
 */
function useStudioPlacement() {
    // The third argument is the server snapshot. Without it useSyncExternalStore
    // throws outright in any server-rendering context, which the web platform can
    // plausibly be -- and the store is a client-side thing, so the honest server
    // answer is "nothing is being placed" rather than a guess.
    const isPlacing = (0, react_1.useSyncExternalStore)(subscribe, () => placementBannerStore_1.studioPlacementBannerStore.isActive(), () => false);
    const name = (0, react_1.useSyncExternalStore)(subscribe, () => placementBannerStore_1.studioPlacementBannerStore.name(), () => null);
    const showMiss = (0, react_1.useSyncExternalStore)(subscribe, () => placementBannerStore_1.studioPlacementBannerStore.showMiss(), () => false);
    return { isPlacing, name, showMiss };
}
