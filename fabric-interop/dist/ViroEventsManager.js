"use strict";
/**
 * ViroEventsManager.ts
 * TypeScript integration for ViroEventsTurboModule
 *
 * This module provides the TypeScript interface for handling
 * Viro JSI events through the TurboModule system
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const ViroEventsTurboModule_1 = __importDefault(require("./specs/ViroEventsTurboModule"));
class ViroEventsManager {
    constructor() {
        this.eventEmitter = new react_native_1.NativeEventEmitter(ViroEventsTurboModule_1.default);
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
     * @param callbackId - The callback ID from JSI
     * @param callback - The JavaScript callback function
     */
    registerJSICallback(callbackId, callback) {
        if (typeof callback === "function") {
            this.callbackRegistry.set(callbackId, callback);
            console.log(`[ViroEventsManager] Registered JSI callback: ${callbackId}`);
        }
        else {
            console.warn(`[ViroEventsManager] Invalid callback for ID: ${callbackId}`);
        }
    }
    /**
     * Unregister a JSI callback
     * @param callbackId - The callback ID to unregister
     */
    unregisterJSICallback(callbackId) {
        if (this.callbackRegistry.has(callbackId)) {
            this.callbackRegistry.delete(callbackId);
            console.log(`[ViroEventsManager] Unregistered JSI callback: ${callbackId}`);
        }
    }
    /**
     * Handle incoming JSI callbacks
     * @param event - The callback event
     */
    handleJSICallback(event) {
        const { callbackId, data } = event;
        const callback = this.callbackRegistry.get(callbackId);
        if (callback) {
            console.log(`[ViroEventsManager] Executing JSI callback: ${callbackId}`, data);
            callback(data);
        }
        else {
            console.warn(`[ViroEventsManager] No callback registered for ID: ${callbackId}`);
        }
    }
    /**
     * Register an event listener for a specific node
     * @param nodeId - The node ID
     * @param eventName - The event name
     * @param callback - The callback function
     * @returns The listener key for removal
     */
    registerNodeEventListener(nodeId, eventName, callback) {
        const listenerKey = `node_${nodeId}_${eventName}`;
        const subscription = this.eventEmitter.addListener(`ViroNodeEvent_${nodeId}_${eventName}`, callback);
        this.listeners.set(listenerKey, subscription);
        console.log(`[ViroEventsManager] Registered node event listener: ${listenerKey}`);
        return listenerKey;
    }
    /**
     * Unregister a node event listener
     * @param listenerKey - The listener key returned from registration
     */
    unregisterNodeEventListener(listenerKey) {
        const subscription = this.listeners.get(listenerKey);
        if (subscription) {
            subscription.remove();
            this.listeners.delete(listenerKey);
            console.log(`[ViroEventsManager] Unregistered node event listener: ${listenerKey}`);
        }
    }
    /**
     * Handle incoming node events
     * @param event - The node event
     */
    handleNodeEvent(event) {
        const { nodeId, eventName, data } = event;
        console.log(`[ViroEventsManager] Node event received: ${nodeId} - ${eventName}`, data);
        // Event will be handled by specific listeners registered via registerNodeEventListener
    }
    /**
     * Register an event listener for a specific scene
     * @param sceneId - The scene ID
     * @param eventName - The event name
     * @param callback - The callback function
     * @returns The listener key for removal
     */
    registerSceneEventListener(sceneId, eventName, callback) {
        const listenerKey = `scene_${sceneId}_${eventName}`;
        const subscription = this.eventEmitter.addListener(`ViroSceneEvent_${sceneId}_${eventName}`, callback);
        this.listeners.set(listenerKey, subscription);
        console.log(`[ViroEventsManager] Registered scene event listener: ${listenerKey}`);
        return listenerKey;
    }
    /**
     * Unregister a scene event listener
     * @param listenerKey - The listener key returned from registration
     */
    unregisterSceneEventListener(listenerKey) {
        const subscription = this.listeners.get(listenerKey);
        if (subscription) {
            subscription.remove();
            this.listeners.delete(listenerKey);
            console.log(`[ViroEventsManager] Unregistered scene event listener: ${listenerKey}`);
        }
    }
    /**
     * Handle incoming scene events
     * @param event - The scene event
     */
    handleSceneEvent(event) {
        const { sceneId, eventName, data } = event;
        console.log(`[ViroEventsManager] Scene event received: ${sceneId} - ${eventName}`, data);
        // Event will be handled by specific listeners registered via registerSceneEventListener
    }
    /**
     * Get the number of active listeners
     * @returns The count of active listeners
     */
    getActiveListenerCount() {
        try {
            return ViroEventsTurboModule_1.default.getActiveListenerCount();
        }
        catch (error) {
            console.error("[ViroEventsManager] Error getting listener count:", error);
            return 0;
        }
    }
    /**
     * Manually emit a JSI callback (for testing)
     * @param callbackId - The callback ID
     * @param eventData - The event data
     */
    emitJSICallback(callbackId, eventData = {}) {
        try {
            ViroEventsTurboModule_1.default.emitJSICallback(callbackId, eventData);
        }
        catch (error) {
            console.error("[ViroEventsManager] Error emitting JSI callback:", error);
        }
    }
    /**
     * Manually emit a node event (for testing)
     * @param nodeId - The node ID
     * @param eventName - The event name
     * @param eventData - The event data
     */
    emitNodeEvent(nodeId, eventName, eventData = {}) {
        try {
            ViroEventsTurboModule_1.default.emitNodeEvent(nodeId, eventName, eventData);
        }
        catch (error) {
            console.error("[ViroEventsManager] Error emitting node event:", error);
        }
    }
    /**
     * Manually emit a scene event (for testing)
     * @param sceneId - The scene ID
     * @param eventName - The event name
     * @param eventData - The event data
     */
    emitSceneEvent(sceneId, eventName, eventData = {}) {
        try {
            ViroEventsTurboModule_1.default.emitSceneEvent(sceneId, eventName, eventData);
        }
        catch (error) {
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
exports.default = new ViroEventsManager();
//# sourceMappingURL=ViroEventsManager.js.map