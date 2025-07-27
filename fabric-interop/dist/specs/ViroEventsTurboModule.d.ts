/**
 * ViroEventsTurboModule.ts
 * TurboModule specification for Viro event emission
 *
 * This module provides proper event emission for JSI callbacks
 * in React Native's New Architecture (Fabric + TurboModules)
 */
import type { TurboModule } from "react-native";
export interface Spec extends TurboModule {
    addListener(eventName: string): void;
    removeListeners(count: number): void;
    emitJSICallback(callbackId: string, eventData: Object): void;
    emitNodeEvent(nodeId: string, eventName: string, eventData: Object): void;
    emitSceneEvent(sceneId: string, eventName: string, eventData: Object): void;
    isEventSystemReady(): boolean;
    getActiveListenerCount(): number;
}
declare const _default: Spec;
export default _default;
//# sourceMappingURL=ViroEventsTurboModule.d.ts.map