/**
 * ViroEventsManager.js
 * JavaScript integration for ViroEventsTurboModule
 *
 * This module provides the JavaScript interface for handling
 * Viro JSI events through the TurboModule system
 */

import { NativeEventEmitter, NativeModules } from "react-native";
import ViroEventsTurboModule from "./specs/ViroEventsTurboModule";

class ViroEventsManager {
  constructor() {
    this.eventEmitter = new NativeEventEmitter(ViroEventsTurboModule);
    this.listeners = new Map();
    this.callbackRegistry = new Map();

    // Set up event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for JSI callbacks
    this.eventEmitter.addListener("ViroJSICallback", (event) => {
      this.handleJSICallback(event);
    });

    // Listen for node events
    this.eventEmitter.addListener("ViroNodeEvent", (event) => {
      this.handleNodeEvent(event);
    });

    // Listen for scene events
    this.eventEmitter.addListener("ViroSceneEvent", (event) => {
      this.handleSceneEvent(event);
    });
  }

  /**
   * Register a callback for JSI events
   * @param {string} callbackId - The callback ID from JSI
   * @param {function} callback - The JavaScript callback function
   */
  registerJSICallback(callbackId, callback) {
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
   * @param {string} callbackId - The callback ID to remove
   */
  unregisterJSICallback(callbackId) {
    if (this.callbackRegistry.has(callbackId)) {
      this.callbackRegistry.delete(callbackId);
      console.log(
        `[ViroEventsManager] Unregistered JSI callback: ${callbackId}`
      );
    }
  }

  /**
   * Register a listener for node events
   * @param {string} nodeId - The node ID
   * @param {string} eventName - The event name
   * @param {function} callback - The callback function
   */
  registerNodeEventListener(nodeId, eventName, callback) {
    const key = `${nodeId}.${eventName}`;
    this.listeners.set(key, callback);
    console.log(`[ViroEventsManager] Registered node event listener: ${key}`);
  }

  /**
   * Register a listener for scene events
   * @param {string} sceneId - The scene ID
   * @param {string} eventName - The event name
   * @param {function} callback - The callback function
   */
  registerSceneEventListener(sceneId, eventName, callback) {
    const key = `scene.${sceneId}.${eventName}`;
    this.listeners.set(key, callback);
    console.log(`[ViroEventsManager] Registered scene event listener: ${key}`);
  }

  /**
   * Handle JSI callback events
   * @private
   */
  handleJSICallback(event) {
    const { callbackId, eventData, timestamp } = event;

    console.log(
      `[ViroEventsManager] Received JSI callback: ${callbackId}`,
      eventData
    );

    const callback = this.callbackRegistry.get(callbackId);
    if (callback) {
      try {
        callback(eventData);
      } catch (error) {
        console.error(
          `[ViroEventsManager] Error executing JSI callback ${callbackId}:`,
          error
        );
      }
    } else {
      console.warn(
        `[ViroEventsManager] No callback registered for ID: ${callbackId}`
      );
    }
  }

  /**
   * Handle node events
   * @private
   */
  handleNodeEvent(event) {
    const { nodeId, eventName, eventData, timestamp } = event;
    const key = `${nodeId}.${eventName}`;

    console.log(`[ViroEventsManager] Received node event: ${key}`, eventData);

    const callback = this.listeners.get(key);
    if (callback) {
      try {
        callback(eventData);
      } catch (error) {
        console.error(
          `[ViroEventsManager] Error executing node event callback ${key}:`,
          error
        );
      }
    }
  }

  /**
   * Handle scene events
   * @private
   */
  handleSceneEvent(event) {
    const { sceneId, eventName, eventData, timestamp } = event;
    const key = `scene.${sceneId}.${eventName}`;

    console.log(`[ViroEventsManager] Received scene event: ${key}`, eventData);

    const callback = this.listeners.get(key);
    if (callback) {
      try {
        callback(eventData);
      } catch (error) {
        console.error(
          `[ViroEventsManager] Error executing scene event callback ${key}:`,
          error
        );
      }
    }
  }

  /**
   * Check if the event system is ready
   * @returns {boolean}
   */
  isEventSystemReady() {
    try {
      return ViroEventsTurboModule.isEventSystemReady();
    } catch (error) {
      console.error(
        "[ViroEventsManager] Error checking event system status:",
        error
      );
      return false;
    }
  }

  /**
   * Get the number of active listeners
   * @returns {number}
   */
  getActiveListenerCount() {
    try {
      return ViroEventsTurboModule.getActiveListenerCount();
    } catch (error) {
      console.error("[ViroEventsManager] Error getting listener count:", error);
      return 0;
    }
  }

  /**
   * Manually emit a JSI callback (for testing)
   * @param {string} callbackId - The callback ID
   * @param {object} eventData - The event data
   */
  emitJSICallback(callbackId, eventData = {}) {
    try {
      ViroEventsTurboModule.emitJSICallback(callbackId, eventData);
    } catch (error) {
      console.error("[ViroEventsManager] Error emitting JSI callback:", error);
    }
  }

  /**
   * Manually emit a node event (for testing)
   * @param {string} nodeId - The node ID
   * @param {string} eventName - The event name
   * @param {object} eventData - The event data
   */
  emitNodeEvent(nodeId, eventName, eventData = {}) {
    try {
      ViroEventsTurboModule.emitNodeEvent(nodeId, eventName, eventData);
    } catch (error) {
      console.error("[ViroEventsManager] Error emitting node event:", error);
    }
  }

  /**
   * Manually emit a scene event (for testing)
   * @param {string} sceneId - The scene ID
   * @param {string} eventName - The event name
   * @param {object} eventData - The event data
   */
  emitSceneEvent(sceneId, eventName, eventData = {}) {
    try {
      ViroEventsTurboModule.emitSceneEvent(sceneId, eventName, eventData);
    } catch (error) {
      console.error("[ViroEventsManager] Error emitting scene event:", error);
    }
  }

  /**
   * Clean up all listeners and callbacks
   */
  cleanup() {
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
