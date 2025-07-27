"use strict";
/**
 * NativeViro - JSI Bridge Functions
 *
 * This module provides direct JSI functions to communicate with the native Viro implementation.
 * These functions bypass the React Native bridge and codegen, providing direct access to
 * the existing native implementation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCallbackId = exports.generateNodeId = void 0;
exports.handleViroEvent = handleViroEvent;
exports.registerEventListener = registerEventListener;
exports.unregisterEventListener = unregisterEventListener;
exports.initializeViro = initializeViro;
exports.createScene = createScene;
exports.activateScene = activateScene;
exports.deactivateScene = deactivateScene;
exports.destroyScene = destroyScene;
exports.getSceneState = getSceneState;
exports.getMemoryStats = getMemoryStats;
exports.performMemoryCleanup = performMemoryCleanup;
exports.createNode = createNode;
exports.updateNode = updateNode;
exports.deleteNode = deleteNode;
exports.addChild = addChild;
exports.removeChild = removeChild;
exports.createMaterial = createMaterial;
exports.updateMaterial = updateMaterial;
exports.createAnimation = createAnimation;
exports.executeAnimation = executeAnimation;
exports.setARPlaneDetection = setARPlaneDetection;
exports.setARImageTargets = setARImageTargets;
exports.isViroJSIAvailable = isViroJSIAvailable;
// The global NativeViro object is injected by the native code
// Note: The type declaration is in the generated .d.ts file
// We don't redeclare it here to avoid conflicts
// Additional methods that may not be in the type declaration
// These are accessed using type assertions in the components
// - recenterTracking(nodeId: string): void
// - project(nodeId: string, point: [number, number, number]): Promise<[number, number, number]>
// - unproject(nodeId: string, point: [number, number, number]): Promise<[number, number, number]>
// Event callback registry
const eventCallbacks = {};
// Generate a unique ID for nodes
let nextNodeId = 1;
const generateNodeId = () => `viro_node_${nextNodeId++}`;
exports.generateNodeId = generateNodeId;
// Generate a unique ID for callbacks
let nextCallbackId = 1;
const generateCallbackId = () => `viro_callback_${nextCallbackId++}`;
exports.generateCallbackId = generateCallbackId;
// Event handler that receives events from native code
function handleViroEvent(callbackId, event) {
    const callback = eventCallbacks[callbackId];
    if (callback) {
        callback(event);
    }
    else {
        console.warn(`No callback found for ID: ${callbackId}`);
    }
}
// Set up the global event handler
if (typeof global !== "undefined") {
    // @ts-ignore - This property will be added by the native code
    global.handleViroEvent = handleViroEvent;
}
const ViroGlobal_1 = require("./components/ViroGlobal");
// Register a JS callback for native events
function registerEventListener(nodeId, eventName, callback) {
    const callbackId = (0, exports.generateCallbackId)();
    eventCallbacks[callbackId] = callback;
    // Register with native code
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        nativeViro.registerEventCallback(nodeId, eventName, callbackId);
    }
    return callbackId;
}
// Unregister a callback
function unregisterEventListener(nodeId, eventName, callbackId) {
    delete eventCallbacks[callbackId];
    // Unregister with native code
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        nativeViro.unregisterEventCallback(nodeId, eventName, callbackId);
    }
}
// Initialize the Viro platform
function initializeViro(config) {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        return nativeViro.initialize(config);
    }
    return Promise.reject(new Error("NativeViro not available"));
}
// Scene Management Functions
function createScene(sceneId, sceneType, props = {}) {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro && nativeViro.createViroScene) {
        nativeViro.createViroScene(sceneId, sceneType, props);
    }
    else {
        console.warn("Scene management not available - createScene");
    }
}
function activateScene(sceneId) {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro && nativeViro.activateViroScene) {
        nativeViro.activateViroScene(sceneId);
    }
    else {
        console.warn("Scene management not available - activateScene");
    }
}
function deactivateScene(sceneId) {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro && nativeViro.deactivateViroScene) {
        nativeViro.deactivateViroScene(sceneId);
    }
    else {
        console.warn("Scene management not available - deactivateScene");
    }
}
function destroyScene(sceneId) {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro && nativeViro.destroyViroScene) {
        nativeViro.destroyViroScene(sceneId);
    }
    else {
        console.warn("Scene management not available - destroyScene");
    }
}
function getSceneState(sceneId) {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro && nativeViro.getViroSceneState) {
        return nativeViro.getViroSceneState(sceneId);
    }
    return null;
}
function getMemoryStats() {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro && nativeViro.getViroMemoryStats) {
        return nativeViro.getViroMemoryStats();
    }
    return null;
}
function performMemoryCleanup() {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro && nativeViro.performViroMemoryCleanup) {
        nativeViro.performViroMemoryCleanup();
    }
    else {
        console.warn("Memory management not available - performMemoryCleanup");
    }
}
// Node Management Functions (enhanced)
function createNode(nodeId, nodeType, props = {}) {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        nativeViro.createViroNode(nodeId, nodeType, props);
    }
    else {
        console.warn("NativeViro not available - createNode");
    }
}
function updateNode(nodeId, props) {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        nativeViro.updateViroNode(nodeId, props);
    }
    else {
        console.warn("NativeViro not available - updateNode");
    }
}
function deleteNode(nodeId) {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        nativeViro.deleteViroNode(nodeId);
    }
    else {
        console.warn("NativeViro not available - deleteNode");
    }
}
function addChild(parentId, childId) {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        nativeViro.addViroNodeChild(parentId, childId);
    }
    else {
        console.warn("NativeViro not available - addChild");
    }
}
function removeChild(parentId, childId) {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        nativeViro.removeViroNodeChild(parentId, childId);
    }
    else {
        console.warn("NativeViro not available - removeChild");
    }
}
// Material Management Functions (enhanced)
function createMaterial(materialName, properties) {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        nativeViro.createViroMaterial(materialName, properties);
    }
    else {
        console.warn("NativeViro not available - createMaterial");
    }
}
function updateMaterial(materialName, properties) {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        nativeViro.updateViroMaterial(materialName, properties);
    }
    else {
        console.warn("NativeViro not available - updateMaterial");
    }
}
// Animation Management Functions (enhanced)
function createAnimation(animationName, properties) {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        nativeViro.createViroAnimation(animationName, properties);
    }
    else {
        console.warn("NativeViro not available - createAnimation");
    }
}
function executeAnimation(nodeId, animationName, options = {}) {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        nativeViro.executeViroAnimation(nodeId, animationName, options);
    }
    else {
        console.warn("NativeViro not available - executeAnimation");
    }
}
// AR Configuration Functions (enhanced)
function setARPlaneDetection(config) {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        nativeViro.setViroARPlaneDetection(config);
    }
    else {
        console.warn("NativeViro not available - setARPlaneDetection");
    }
}
function setARImageTargets(targets) {
    const nativeViro = (0, ViroGlobal_1.getNativeViro)();
    if (nativeViro) {
        nativeViro.setViroARImageTargets(targets);
    }
    else {
        console.warn("NativeViro not available - setARImageTargets");
    }
}
// Check if the JSI interface is available
function isViroJSIAvailable() {
    return (0, ViroGlobal_1.isNativeViroAvailable)();
}
//# sourceMappingURL=NativeViro.js.map