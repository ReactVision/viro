/**
 * ViroEventsManager.ts
 * TypeScript integration for ViroEventsTurboModule
 *
 * This module provides the TypeScript interface for handling
 * Viro JSI events through the TurboModule system
 */
interface EventData {
    [key: string]: any;
}
type EventCallback = (data: EventData) => void;
type JSICallback = (data?: EventData) => void;
declare class ViroEventsManager {
    private eventEmitter;
    private listeners;
    private callbackRegistry;
    constructor();
    private setupEventListeners;
    /**
     * Register a callback for JSI events
     * @param callbackId - The callback ID from JSI
     * @param callback - The JavaScript callback function
     */
    registerJSICallback(callbackId: string, callback: JSICallback): void;
    /**
     * Unregister a JSI callback
     * @param callbackId - The callback ID to unregister
     */
    unregisterJSICallback(callbackId: string): void;
    /**
     * Handle incoming JSI callbacks
     * @param event - The callback event
     */
    private handleJSICallback;
    /**
     * Register an event listener for a specific node
     * @param nodeId - The node ID
     * @param eventName - The event name
     * @param callback - The callback function
     * @returns The listener key for removal
     */
    registerNodeEventListener(nodeId: string, eventName: string, callback: EventCallback): string;
    /**
     * Unregister a node event listener
     * @param listenerKey - The listener key returned from registration
     */
    unregisterNodeEventListener(listenerKey: string): void;
    /**
     * Handle incoming node events
     * @param event - The node event
     */
    private handleNodeEvent;
    /**
     * Register an event listener for a specific scene
     * @param sceneId - The scene ID
     * @param eventName - The event name
     * @param callback - The callback function
     * @returns The listener key for removal
     */
    registerSceneEventListener(sceneId: string, eventName: string, callback: EventCallback): string;
    /**
     * Unregister a scene event listener
     * @param listenerKey - The listener key returned from registration
     */
    unregisterSceneEventListener(listenerKey: string): void;
    /**
     * Handle incoming scene events
     * @param event - The scene event
     */
    private handleSceneEvent;
    /**
     * Get the number of active listeners
     * @returns The count of active listeners
     */
    getActiveListenerCount(): number;
    /**
     * Manually emit a JSI callback (for testing)
     * @param callbackId - The callback ID
     * @param eventData - The event data
     */
    emitJSICallback(callbackId: string, eventData?: EventData): void;
    /**
     * Manually emit a node event (for testing)
     * @param nodeId - The node ID
     * @param eventName - The event name
     * @param eventData - The event data
     */
    emitNodeEvent(nodeId: string, eventName: string, eventData?: EventData): void;
    /**
     * Manually emit a scene event (for testing)
     * @param sceneId - The scene ID
     * @param eventName - The event name
     * @param eventData - The event data
     */
    emitSceneEvent(sceneId: string, eventName: string, eventData?: EventData): void;
    /**
     * Clean up all listeners and callbacks
     */
    cleanup(): void;
}
declare const _default: ViroEventsManager;
export default _default;
//# sourceMappingURL=ViroEventsManager.d.ts.map