"use strict";
/**
 * Viro3DSceneNavigator
 *
 * Component for transitioning between multiple scenes in a 3D environment.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Viro3DSceneNavigator = Viro3DSceneNavigator;
const React = __importStar(require("react"));
const react_1 = require("react");
const react_native_1 = require("react-native");
const NativeViro_1 = require("../NativeViro");
const ViroGlobal_1 = require("./ViroGlobal");
/**
 * Viro3DSceneNavigator is used to transition between multiple scenes.
 */
function Viro3DSceneNavigator(props) {
    const { initialSceneKey, initialScene, viroAppProps, onExitViro, debug = false, hdrEnabled, pbrEnabled, bloomEnabled, shadowsEnabled, multisamplingEnabled, style, ...rest } = props;
    // Generate a random tag for scenes
    const mathRandomOffsetRef = (0, react_1.useRef)(0);
    const getRandomTag = () => {
        const randomTag = Math.random() + mathRandomOffsetRef.current;
        mathRandomOffsetRef.current++;
        return randomTag.toString();
    };
    // Initialize state
    const initialTag = initialSceneKey || getRandomTag();
    const initialSceneObj = {
        sceneClass: initialScene,
        tag: initialTag,
        referenceCount: 1,
    };
    const [sceneDictionary, setSceneDictionary] = (0, react_1.useState)({
        [initialTag]: initialSceneObj,
    });
    const [sceneHistory, setSceneHistory] = (0, react_1.useState)([initialTag]);
    const [currentSceneIndex, setCurrentSceneIndex] = (0, react_1.useState)(0);
    // Create a ref for the navigator node
    const navigatorRef = (0, react_1.useRef)((0, NativeViro_1.generateNodeId)());
    // Set up event listeners
    (0, react_1.useEffect)(() => {
        if (!navigatorRef.current)
            return;
        const exitViroCallbackId = onExitViro
            ? (0, NativeViro_1.registerEventListener)(navigatorRef.current, "onExitViro", () => {
                onExitViro();
            })
            : null;
        // Clean up event listeners
        return () => {
            if (exitViroCallbackId) {
                (0, NativeViro_1.unregisterEventListener)(navigatorRef.current, "onExitViro", exitViroCallbackId);
            }
        };
    }, [navigatorRef.current, onExitViro]);
    /**
     * Increments the reference count for a scene within sceneDictionary that is
     * mapped to the given sceneKey. If no scenes are found / mapped, we create
     * one, initialize it with a reference count of 1, and store it within the
     * sceneDictionary for future reference.
     */
    const incrementSceneReference = (scene, sceneKey, limitOne) => {
        setSceneDictionary((prevDictionary) => {
            const newDictionary = { ...prevDictionary };
            if (!(sceneKey in newDictionary)) {
                const newScene = {
                    sceneClass: scene,
                    tag: sceneKey,
                    referenceCount: 0,
                };
                newDictionary[sceneKey] = newScene;
            }
            // Error out if there are no scenes matching the given sceneKey
            const currentScene = newDictionary[sceneKey];
            if (!currentScene) {
                console.log("ERROR: No scene found for: " + sceneKey);
                return prevDictionary;
            }
            // Update the scene's reference count
            if ((limitOne && currentScene.referenceCount < 1) || !limitOne) {
                currentScene.referenceCount++;
            }
            newDictionary[sceneKey] = currentScene;
            return newDictionary;
        });
    };
    /**
     * Decrements the reference count for the last N scenes within
     * the sceneHistory by 1. If nothing else references that given scene
     * (counts equals 0), we then remove that scene from sceneDictionary.
     */
    const decrementReferenceForLastNScenes = (n) => {
        setSceneDictionary((prevDictionary) => {
            const newDictionary = { ...prevDictionary };
            // Now update and release any reference counts
            for (let i = 1; i <= n; i++) {
                const sceneTag = sceneHistory[sceneHistory.length - i];
                const scene = newDictionary[sceneTag];
                if (!scene)
                    continue;
                scene.referenceCount--;
                if (scene.referenceCount <= 0) {
                    delete newDictionary[sceneTag];
                }
                else {
                    newDictionary[sceneTag] = scene;
                }
            }
            return newDictionary;
        });
    };
    /**
     * Adds the given sceneKey to the sceneHistory and updates the currentSceneIndex to point
     * to the scene on the top of the history stack (the most recent scene).
     */
    const addToHistory = (sceneKey) => {
        setSceneHistory((prevHistory) => [...prevHistory, sceneKey]);
        // Find the index of the scene in the dictionary
        let index = 0;
        for (const key in sceneDictionary) {
            if (sceneKey === sceneDictionary[key].tag) {
                setCurrentSceneIndex(index);
                break;
            }
            index++;
        }
    };
    /**
     * Instead of preserving history, we find the last pushed sceneKey within the history stack
     * matching the given sceneKey and re-order it to the front.
     */
    const reorderHistory = (sceneKey) => {
        setSceneHistory((prevHistory) => {
            // Find the last sceneKey within sceneHistory and remove it
            const newHistory = [...prevHistory];
            for (let i = newHistory.length - 1; i >= 0; i--) {
                if (sceneKey === newHistory[i]) {
                    newHistory.splice(i, 1);
                    break;
                }
            }
            // Add back the sceneKey to the front of the History stack
            return [...newHistory, sceneKey];
        });
        // Find the index of the scene in the dictionary
        let index = 0;
        for (const key in sceneDictionary) {
            if (sceneKey === sceneDictionary[key].tag) {
                setCurrentSceneIndex(index);
                break;
            }
            index++;
        }
    };
    /**
     * Removes the last N scenes from the history stack
     */
    const popHistoryByN = (n) => {
        setSceneHistory((prevHistory) => {
            const newHistory = [...prevHistory];
            newHistory.splice(newHistory.length - n, n);
            // Find the index of the last scene in the dictionary
            if (newHistory.length > 0) {
                const lastSceneTag = newHistory[newHistory.length - 1];
                let index = 0;
                for (const key in sceneDictionary) {
                    if (lastSceneTag === sceneDictionary[key].tag) {
                        setCurrentSceneIndex(index);
                        break;
                    }
                    index++;
                }
            }
            return newHistory;
        });
    };
    /**
     * Pushes a scene and reference it with the given key if provided.
     */
    const push = (param1, param2) => {
        let sceneKey = undefined;
        let scene = undefined;
        if (typeof param1 === "string") {
            sceneKey = param1;
            scene = param2;
        }
        else {
            scene = param1;
        }
        if (scene === undefined && sceneKey === undefined) {
            console.log("ERROR: pushing requires either the scene tag, or both the tag and scene.");
            return;
        }
        else if (scene === undefined &&
            sceneKey !== undefined &&
            !(sceneKey in sceneDictionary)) {
            console.log("ERROR: Cannot push with a new sceneKey with no associated scene.");
            return;
        }
        if (sceneKey === undefined ||
            (typeof sceneKey === "string" && sceneKey.trim().length <= 0)) {
            sceneKey = getRandomTag();
        }
        incrementSceneReference(scene, sceneKey, false);
        addToHistory(sceneKey);
    };
    /**
     * Replace the top scene in the stack with the given scene.
     */
    const replace = (param1, param2) => {
        let sceneKey = undefined;
        let scene = undefined;
        if (typeof param1 === "string") {
            sceneKey = param1;
            scene = param2;
        }
        else {
            scene = param1;
        }
        if (scene === undefined && sceneKey === undefined) {
            console.log("ERROR: replacing requires either the scene tag, or both the tag and scene.");
            return;
        }
        else if (scene === undefined &&
            sceneKey !== undefined &&
            !(sceneKey in sceneDictionary)) {
            console.log("ERROR: Cannot replace with a new sceneKey with no associated scene.");
            return;
        }
        if (sceneKey === undefined ||
            (typeof sceneKey === "string" && sceneKey.trim().length <= 0)) {
            sceneKey = getRandomTag();
        }
        // Pop 1 off the scene history, then push this scene
        decrementReferenceForLastNScenes(1);
        popHistoryByN(1);
        incrementSceneReference(scene, sceneKey, false);
        addToHistory(sceneKey);
    };
    /**
     * Jumps to a given scene that had been previously pushed.
     */
    const jump = (param1, param2) => {
        let sceneKey = undefined;
        let scene = undefined;
        if (typeof param1 === "string") {
            sceneKey = param1;
            scene = param2;
        }
        else {
            scene = param1;
        }
        if (scene === undefined && sceneKey === undefined) {
            console.log("ERROR: jumping requires either the scene tag, or both the tag and scene.");
            return;
        }
        else if (scene === undefined &&
            sceneKey !== undefined &&
            !(sceneKey in sceneDictionary)) {
            console.log("ERROR: Cannot jump with a new sceneKey with no associated scene.");
            return;
        }
        if (sceneKey === undefined ||
            (typeof sceneKey === "string" && sceneKey.trim().length <= 0)) {
            sceneKey = getRandomTag();
        }
        incrementSceneReference(scene, sceneKey, true);
        reorderHistory(sceneKey);
    };
    /**
     * Pops the current scene from the stack
     */
    const pop = () => {
        popN(1);
    };
    /**
     * Pops N scenes from the stack
     */
    const popN = (n) => {
        if (n === 0) {
            return;
        }
        if (sceneHistory.length - n <= 0) {
            console.log("WARN: Attempted to pop the root scene in ViroSceneNavigator!");
            return;
        }
        decrementReferenceForLastNScenes(n);
        popHistoryByN(n);
    };
    /**
     * Recenter the tracking
     */
    const recenterTracking = () => {
        const nativeViro = (0, ViroGlobal_1.getNativeViro)();
        if (nativeViro && navigatorRef.current) {
            nativeViro.recenterTracking(navigatorRef.current);
        }
    };
    /**
     * Project a 3D point to screen space
     */
    const project = async (point) => {
        const nativeViro = (0, ViroGlobal_1.getNativeViro)();
        if (nativeViro && navigatorRef.current) {
            return await nativeViro.project(navigatorRef.current, point);
        }
        return null;
    };
    /**
     * Unproject a screen point to 3D space
     */
    const unproject = async (point) => {
        const nativeViro = (0, ViroGlobal_1.getNativeViro)();
        if (nativeViro && navigatorRef.current) {
            return await nativeViro.unproject(navigatorRef.current, point);
        }
        return null;
    };
    // Create the sceneNavigator object to pass to scenes
    const sceneNavigator = {
        push,
        pop,
        popN,
        jump,
        replace,
        recenterTracking,
        project,
        unproject,
        viroAppProps: viroAppProps || {},
    };
    // Render the scenes
    const renderScenes = () => {
        const views = [];
        let i = 0;
        for (const key in sceneDictionary) {
            const sceneInfo = sceneDictionary[key];
            const Component = sceneInfo.sceneClass.scene;
            const passProps = sceneInfo.sceneClass.passProps || {};
            views.push(<Component key={`scene${i}`} sceneNavigator={sceneNavigator} {...passProps}/>);
            i++;
        }
        return views;
    };
    // Render the navigator
    return (<react_native_1.View style={[styles.container, style]} {...rest}>
      {renderScenes()}
    </react_native_1.View>);
}
const styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
});
//# sourceMappingURL=Viro3DSceneNavigator.js.map