/**
 * ViroEventsManager.ts
 * TypeScript integration for ViroEventsTurboModule
 *
 * This module provides the TypeScript interface for handling
 * Viro JSI events through the TurboModule system
 */

import { NativeEventEmitter, EmitterSubscription } from "react-native";
import ViroEventsTurboModule from "./specs/ViroEventsTurboModule";

interface EventData {
  [key: string]: any;
}

interface JSICallbackEvent {
  callbackId: string;
  data?: EventData;
}

interface NodeEvent {
  nodeId: string;
  eventName: string;
  data?: EventData;
}

interface SceneEvent {
  sceneId: string;
  eventName: string;
  data?: EventData;
}

type EventCallback = (data: EventData) => void;
type JSICallback = (data?: EventData) => void;

class ViroEventsManager {
  private eventEmitter: NativeEventEmitter;
  private listeners: Map<string, EmitterSubscription>;
  private callbackRegistry: Map<string, JSICallback>;

  constructor() {
    this.eventEmitter = new NativeEventEmitter(ViroEventsTurboModule as any);
    this.listeners = new Map();
    this.callbackRegistry = new Map();

    // Set up event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for JSI callbacks
    this.eventEmitter.addListener("ViroJSICallback", (event: JSICallbackEvent) => {
      this.handleJSICallback(event);
    });

    // Listen for node events
    this.eventEmitter.addListener("ViroNodeEvent", (event: NodeEvent) => {
      this.handleNodeEvent(event);
    });

    // Listen for scene events
    this.eventEmitter.addListener("ViroSceneEvent", (event: SceneEvent) => {
      this.handleSceneEvent(event);
    });
  }

  /**
   * Register a callback for JSI events
   * @param callbackId - The callback ID from JSI
   * @param callback - The JavaScript callback function
   */
  registerJSICallback(callbackId: string, callback: JSICallback): void {
    if (typeof callback === "function") {
      this.callbackRegistry.set(callbackId, callback);
      console.log(`[ViroEventsManager] Registered JSI callback: ${callbackId}`);
    } else {
      console.warn(
        `[ViroEventsManager] Invalid callback for ID: ${callbackId}`
      );
    }
  }

  /**
   * Unregister a JSI callback
   * @param callbackId - The callback ID to unregister
   */
  unregisterJSICallback(callbackId: string): void {
    if (this.callbackRegistry.has(callbackId)) {
      this.callbackRegistry.delete(callbackId);
      console.log(
        `[ViroEventsManager] Unregistered JSI callback: ${callbackId}`
      );
    }
  }

  /**
   * Handle incoming JSI callbacks
   * @param event - The callback event
   */
  private handleJSICallback(event: JSICallbackEvent): void {
    const { callbackId, data } = event;
    const callback = this.callbackRegistry.get(callbackId);

    if (callback) {
      console.log(
        `[ViroEventsManager] Executing JSI callback: ${callbackId}`,
        data
      );
      callback(data);
    } else {
      console.warn(
        `[ViroEventsManager] No callback registered for ID: ${callbackId}`
      );
    }
  }

  /**
   * Register an event listener for a specific node
   * @param nodeId - The node ID
   * @param eventName - The event name
   * @param callback - The callback function
   * @returns The listener key for removal
   */
  registerNodeEventListener(
    nodeId: string,
    eventName: string,
    callback: EventCallback
  ): string {
    const listenerKey = `node_${nodeId}_${eventName}`;
    const subscription = this.eventEmitter.addListener(
      `ViroNodeEvent_${nodeId}_${eventName}`,
      callback
    );
    this.listeners.set(listenerKey, subscription);

    console.log(
      `[ViroEventsManager] Registered node event listener: ${listenerKey}`
    );
    return listenerKey;
  }

  /**
   * Unregister a node event listener
   * @param listenerKey - The listener key returned from registration
   */
  unregisterNodeEventListener(listenerKey: string): void {
    const subscription = this.listeners.get(listenerKey);
    if (subscription) {
      subscription.remove();
      this.listeners.delete(listenerKey);
      console.log(
        `[ViroEventsManager] Unregistered node event listener: ${listenerKey}`
      );
    }
  }

  /**
   * Handle incoming node events
   * @param event - The node event
   */
  private handleNodeEvent(event: NodeEvent): void {
    const { nodeId, eventName, data } = event;
    console.log(
      `[ViroEventsManager] Node event received: ${nodeId} - ${eventName}`,
      data
    );
    // Event will be handled by specific listeners registered via registerNodeEventListener
  }

  /**
   * Register an event listener for a specific scene
   * @param sceneId - The scene ID
   * @param eventName - The event name
   * @param callback - The callback function
   * @returns The listener key for removal
   */
  registerSceneEventListener(
    sceneId: string,
    eventName: string,
    callback: EventCallback
  ): string {
    const listenerKey = `scene_${sceneId}_${eventName}`;
    const subscription = this.eventEmitter.addListener(
      `ViroSceneEvent_${sceneId}_${eventName}`,
      callback
    );
    this.listeners.set(listenerKey, subscription);

    console.log(
      `[ViroEventsManager] Registered scene event listener: ${listenerKey}`
    );
    return listenerKey;
  }

  /**
   * Unregister a scene event listener
   * @param listenerKey - The listener key returned from registration
   */
  unregisterSceneEventListener(listenerKey: string): void {
    const subscription = this.listeners.get(listenerKey);
    if (subscription) {
      subscription.remove();
      this.listeners.delete(listenerKey);
      console.log(
        `[ViroEventsManager] Unregistered scene event listener: ${listenerKey}`
      );
    }
  }

  /**
   * Handle incoming scene events
   * @param event - The scene event
   */
  private handleSceneEvent(event: SceneEvent): void {
    const { sceneId, eventName, data } = event;
    console.log(
      `[ViroEventsManager] Scene event received: ${sceneId} - ${eventName}`,
      data
    );
    // Event will be handled by specific listeners registered via registerSceneEventListener
  }

  /**
   * Get the number of active listeners
   * @returns The count of active listeners
   */
  getActiveListenerCount(): number {
    try {
      return ViroEventsTurboModule.getActiveListenerCount();
    } catch (error) {
      console.error("[ViroEventsManager] Error getting listener count:", error);
      return 0;
    }
  }

  /**
   * Manually emit a JSI callback (for testing)
   * @param callbackId - The callback ID
   * @param eventData - The event data
   */
  emitJSICallback(callbackId: string, eventData: EventData = {}): void {
    try {
      ViroEventsTurboModule.emitJSICallback(callbackId, eventData);
    } catch (error) {
      console.error("[ViroEventsManager] Error emitting JSI callback:", error);
    }
  }

  /**
   * Manually emit a node event (for testing)
   * @param nodeId - The node ID
   * @param eventName - The event name
   * @param eventData - The event data
   */
  emitNodeEvent(nodeId: string, eventName: string, eventData: EventData = {}): void {
    try {
      ViroEventsTurboModule.emitNodeEvent(nodeId, eventName, eventData);
    } catch (error) {
      console.error("[ViroEventsManager] Error emitting node event:", error);
    }
  }

  /**
   * Manually emit a scene event (for testing)
   * @param sceneId - The scene ID
   * @param eventName - The event name
   * @param eventData - The event data
   */
  emitSceneEvent(sceneId: string, eventName: string, eventData: EventData = {}): void {
    try {
      ViroEventsTurboModule.emitSceneEvent(sceneId, eventName, eventData);
    } catch (error) {
      console.error("[ViroEventsManager] Error emitting scene event:", error);
    }
  }

  /**
   * Clean up all listeners and callbacks
   */
  cleanup(): void {
    console.log("[ViroEventsManager] Cleaning up event manager");

    // Remove all event listeners
    this.eventEmitter.removeAllListeners("ViroJSICallback");
    this.eventEmitter.removeAllListeners("ViroNodeEvent");
    this.eventEmitter.removeAllListeners("ViroSceneEvent");

    // Clear registries
    this.listeners.clear();
    this.callbackRegistry.clear();

    console.log("[ViroEventsManager] Event manager cleanup completed");
  }
}

// Export singleton instance
export default new ViroEventsManager();