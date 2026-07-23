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
    const isPlacing = (0, react_1.useSyncExternalStore)(subscribe, () => placementBannerStore_1.studioPlacementBannerStore.isActive());
    const name = (0, react_1.useSyncExternalStore)(subscribe, () => placementBannerStore_1.studioPlacementBannerStore.name());
    const showMiss = (0, react_1.useSyncExternalStore)(subscribe, () => placementBannerStore_1.studioPlacementBannerStore.showMiss());
    return { isPlacing, name, showMiss };
}
