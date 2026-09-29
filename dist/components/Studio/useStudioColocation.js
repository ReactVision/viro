"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useStudioColocation = useStudioColocation;
const react_1 = require("react");
const colocationStore_1 = require("./domain/colocationStore");
const IDLE = { status: "idle" };
const subscribe = (onChange) => colocationStore_1.studioColocationStore.subscribe(onChange);
/**
 * Subscribe to the shared session StudioSceneNavigator is running (its
 * `colocation` prop). Hosts build their own co-location UI with this, or render
 * <StudioColocationIndicator /> in their own chrome. The server snapshot is idle:
 * see the note in useStudioPlacement.
 */
function useStudioColocation() {
    return (0, react_1.useSyncExternalStore)(subscribe, () => colocationStore_1.studioColocationStore.getState(), () => IDLE);
}
