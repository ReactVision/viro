/**
 * ViroEventsTurboModule.ts
 * TurboModule specification for Viro event emission
 *
 * This module provides proper event emission for JSI callbacks
 * in React Native's New Architecture (Fabric + TurboModules)
 */

import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

export interface Spec extends TurboModule {
  // Event listener management
  addListener(eventName: string): void;
  removeListeners(count: number): void;

  // Event emission methods
  emitJSICallback(callbackId: string, eventData: Object): void;
  emitNodeEvent(nodeId: string, eventName: string, eventData: Object): void;
  emitSceneEvent(sceneId: string, eventName: string, eventData: Object): void;

  // Utility methods
  isEventSystemReady(): boolean;
  getActiveListenerCount(): number;
}

export default TurboModuleRegistry.getEnforcing<Spec>("ViroEvents");
