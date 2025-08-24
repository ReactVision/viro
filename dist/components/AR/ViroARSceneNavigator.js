/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroARSceneNavigator
 * @flow
 */
"use strict";
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
exports.ViroARSceneNavigator = void 0;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
const ViroARSceneNavigatorModule = react_native_1.NativeModules.VRTARSceneNavigatorModule;
let mathRandomOffset = 0;
/**
 * ViroARSceneNavigator is used to transition between multiple AR Scenes.
 */
class ViroARSceneNavigator extends React.Component {
    _component = null;
    constructor(props) {
        super(props);
        let initialSceneTag = this.props.initialSceneKey;
        if (initialSceneTag == null) {
            initialSceneTag = this.getRandomTag();
        }
        const scene = {
            sceneClass: this.props.initialScene,
            tag: initialSceneTag,
            referenceCount: 1,
        };
        const sceneDict = {};
        sceneDict[scene.tag] = scene;
        this.state = {
            sceneDictionary: sceneDict,
            sceneHistory: [scene.tag],
            currentSceneIndex: 0,
        };
    }
    /**
     * Starts recording video of the Viro renderer and external audio
     *
     * @param fileName - name of the file (without extension)
     * @param saveToCameraRoll - whether or not the file should also be saved to the camera roll
     * @param onError - callback function that accepts an errorCode.
     */
    _startVideoRecording = (fileName, saveToCameraRoll, 
    // TODO: What are the errorCodes? make a type for this
    onError) => {
        ViroARSceneNavigatorModule.startVideoRecording((0, react_native_1.findNodeHandle)(this), fileName, saveToCameraRoll, onError);
    };
    /**
     * Stops recording the video of the Viro Renderer.
     *
     * returns Object w/ success, url and errorCode keys.
     * @returns Promise that resolves when the video has stopped recording.
     */
    _stopVideoRecording = async () => {
        return await ViroARSceneNavigatorModule.stopVideoRecording((0, react_native_1.findNodeHandle)(this));
    };
    /**
     * Takes a screenshot of the Viro renderer
     *
     * @param fileName - name of the file (without extension)
     * @param saveToCameraRoll - whether or not the file should also be saved to the camera roll
     * returns Object w/ success, url and errorCode keys.
     */
    _takeScreenshot = async (fileName, saveToCameraRoll) => {
        return await ViroARSceneNavigatorModule.takeScreenshot((0, react_native_1.findNodeHandle)(this), fileName, saveToCameraRoll);
    };
    /**
     * @todo document _project
     *
     * @param point
     * @returns
     */
    _project = async (point) => {
        return await ViroARSceneNavigatorModule.project((0, react_native_1.findNodeHandle)(this), point);
    };
    /**
     * TODO: Document _unproject
     *
     * @param point
     * @returns
     */
    _unproject = async (point) => {
        return await ViroARSceneNavigatorModule.unproject((0, react_native_1.findNodeHandle)(this), point);
    };
    /**
     * Gets a random tag string.
     *
     * @returns a random tag.
     */
    getRandomTag = () => {
        const randomTag = Math.random() + mathRandomOffset;
        mathRandomOffset++;
        return randomTag.toString();
    };
    /**
     * Pushes a scene and reference it with the given key if provided.
     * If the scene has been previously pushed, we simply show the scene again.
     * Note that the back history order of which scenes were pushed is preserved.
     * Also note that scenes are reference counted and only a unique set of
     * scenes are stored and mapped to within sceneDictionary.
     *
     * Can take in either 1 or two parameters in the form:
     * push ("sceneKey");
     * push ("sceneKey", scene);
     * push (scene);
     *
     * @todo use Typescript function overloading rather than this inaccurate solution
     * @todo document parameters
     */
    push = (param1, param2) => {
        let sceneKey = undefined;
        let scene = undefined;
        if (typeof param1 == "string") {
            sceneKey = param1;
            scene = param2;
        }
        else {
            scene = param1;
        }
        if (scene == undefined && sceneKey == undefined) {
            console.log("ERROR: pushing requires either the scene tag, or both the tag and scene.");
            return;
        }
        else if (scene == undefined &&
            sceneKey != undefined &&
            !(sceneKey in this.state.sceneDictionary)) {
            console.log("ERROR: Cannot push with a new sceneKey with no associated scene.");
            return;
        }
        if (sceneKey == undefined ||
            (typeof sceneKey == "string" && sceneKey.trim().length <= 0)) {
            sceneKey = this.getRandomTag();
        }
        this.incrementSceneReference(scene, sceneKey, false);
        this.addToHistory(sceneKey);
    };
    /**
     * Replace the top scene in the stack with the given scene. The remainder of the back
     * history is kept in the same order as before.
     *
     * Can take in either 1 or two parameters in the form:
     * replace ("sceneKey");
     * replace ("sceneKey", scene);
     * replace (scene);
     *
     * @todo use Typescript function overloading rather than this inaccurate solution
     * @todo document parameters
     */
    replace = (param1, param2) => {
        let sceneKey = undefined;
        let scene = undefined;
        if (typeof param1 == "string") {
            sceneKey = param1;
            scene = param2;
        }
        else {
            scene = param1;
        }
        if (scene == undefined && sceneKey == undefined) {
            console.log("ERROR: replacing requires either the scene tag, or both the tag and scene.");
            return;
        }
        else if (scene == undefined &&
            sceneKey != undefined &&
            !(sceneKey in this.state.sceneDictionary)) {
            console.log("ERROR: Cannot replace with a new sceneKey with no associated scene.");
            return;
        }
        if (sceneKey == undefined ||
            (typeof sceneKey == "string" && sceneKey.trim().length <= 0)) {
            sceneKey = this.getRandomTag();
        }
        // Pop 1 off the scene history (do not use popN because in this case we allow
        // popping the root), then push this scene
        this.decrementReferenceForLastNScenes(1);
        this.popHistoryByN(1);
        this.incrementSceneReference(scene, sceneKey, false);
        this.addToHistory(sceneKey);
    };
    /**
     * Jumps to a given scene that had been previously pushed. If the scene was not pushed, we
     * then push and jump to it. The back history is re-ordered such that jumped to scenes are
     * re-ordered to the front. As such, only the back order of sequential jumps are preserved.
     *
     * Can take in either 1 or two parameters in the form:
     * jump ("sceneKey");
     * jump ("sceneKey", scene);
     * jump (scene);
     *
     * @todo use Typescript function overloading rather than this inaccurate solution
     * @todo document parameters
     */
    jump = (param1, param2) => {
        let sceneKey = undefined;
        let scene = undefined;
        if (typeof param1 == "string") {
            sceneKey = param1;
            scene = param2;
        }
        else {
            scene = param1;
        }
        if (scene == undefined && sceneKey == undefined) {
            console.log("ERROR: jumping requires either the scene tag, or both the tag and scene.");
            return;
        }
        else if (scene == undefined &&
            sceneKey != undefined &&
            !(sceneKey in this.state.sceneDictionary)) {
            console.log("ERROR: Cannot jump with a new sceneKey with no associated scene.");
            return;
        }
        if (sceneKey == undefined ||
            (typeof sceneKey == "string" && sceneKey.trim().length <= 0)) {
            sceneKey = this.getRandomTag();
        }
        this.incrementSceneReference(scene, sceneKey, true);
        this.reorderHistory(sceneKey);
    };
    /**
     * Pop 1 screen from the stack.
     */
    pop = () => {
        this.popN(1);
    };
    /**
     * Pop n screens from the stack.
     *
     * @param n number of scenes to pop
     * @returns void
     */
    popN = (n) => {
        if (n === 0) {
            return;
        }
        if (this.state.sceneHistory.length - n <= 0) {
            console.log("WARN: Attempted to pop the root scene in ViroARSceneNavigator!");
            return;
        }
        this.decrementReferenceForLastNScenes(n);
        this.popHistoryByN(n);
    };
    /**
     * Increments the reference count for a scene within sceneDictionary that is
     * mapped to the given sceneKey. If no scenes are found / mapped, we create
     * one, initialize it with a reference count of 1, and store it within the
     * sceneDictionary for future reference.
     *
     * @todo TODO: Document parameters.
     */
    incrementSceneReference = (scene, sceneKey, limitOne) => {
        const currentSceneDictionary = this.state.sceneDictionary;
        if (!(sceneKey in currentSceneDictionary)) {
            const newScene = {
                sceneClass: scene,
                tag: sceneKey,
                referenceCount: 0,
            };
            currentSceneDictionary[sceneKey] = newScene;
        }
        // Error out if there are no scenes matching the given sceneKey
        const currentScene = currentSceneDictionary[sceneKey];
        if (currentScene == null || currentScene == undefined) {
            console.log("ERROR: No scene found for: " + sceneKey);
            return;
        }
        // Update the scene's reference count and then the sceneDictionary
        if ((limitOne && currentScene.referenceCount < 1) || !limitOne) {
            currentScene.referenceCount++;
        }
        currentSceneDictionary[sceneKey] = currentScene;
        // Finally update all states
        this.setState({
            sceneDictionary: currentSceneDictionary,
        });
    };
    /**
     * Decrements the reference count for the last N scenes within
     * the sceneHistory by 1. If nothing else references that given scene
     * (counts equals 0), we then remove that scene from sceneDictionary.
     *
     * @param n number to decrement by.
     */
    decrementReferenceForLastNScenes = (n) => {
        const { sceneHistory, sceneDictionary } = this.state;
        // Now update and release any reference counts
        for (let i = 1; i <= n; i++) {
            const sceneTag = sceneHistory[sceneHistory.length - i];
            const scene = sceneDictionary[sceneTag];
            scene.referenceCount--;
            if (scene.referenceCount <= 0) {
                delete sceneDictionary[sceneTag];
            }
            else {
                sceneDictionary[sceneTag] = scene;
            }
        }
        // Finally update all states
        this.setState({
            sceneDictionary: sceneDictionary,
        });
    };
    /**
     * Adds the given sceneKey to the sceneHistory and updates the currentSceneIndex to point
     * to the scene on the top of the history stack (the most recent scene).
     *
     * @param sceneKey scene to insert into the stack.
     */
    addToHistory = (sceneKey) => {
        const updatedHistory = this.state.sceneHistory.concat([sceneKey]);
        const currentIndex = this.getSceneIndex(sceneKey);
        this.setState({
            currentSceneIndex: currentIndex,
            sceneHistory: updatedHistory,
        });
    };
    /**
     * Instead of preserving history, we find the last pushed sceneKey within the history stack
     * matching the given sceneKey and re-order it to the front. We then update the
     * currentSceneIndex to point to the scene on the top of the history stack
     * (the most recent scene).
     *
     * @param sceneKey scene to put at the top of the stack.
     */
    reorderHistory = (sceneKey) => {
        // Find the last sceneKey within sceneHistory and remove it.
        const { sceneHistory } = this.state;
        for (let i = sceneHistory.length - 1; i >= 0; i--) {
            if (sceneKey == sceneHistory[i]) {
                sceneHistory.splice(i, 1);
                break;
            }
        }
        // Add back the sceneKey to the front of the History stack.
        const updatedHistory = sceneHistory.concat([sceneKey]);
        const currentIndex = this.getSceneIndex(sceneKey);
        this.setState({
            currentSceneIndex: currentIndex,
            sceneHistory: updatedHistory,
        });
    };
    /**
     * Pops the history entries by n screens.
     *
     * @param n number of history entries to pop.
     */
    popHistoryByN(n) {
        const { sceneHistory } = this.state;
        sceneHistory.splice(sceneHistory.length - n, n);
        const currentIndex = this.getSceneIndex(sceneHistory[sceneHistory.length - 1]);
        // Finally update all states
        this.setState({
            currentSceneIndex: currentIndex,
            sceneHistory: sceneHistory,
        });
    }
    /**
     * Gets the index of a scene by the scene tag.
     *
     * @param sceneTag tag of the scene
     * @returns the index of the scene
     */
    getSceneIndex = (sceneTag) => {
        const { sceneDictionary } = this.state;
        let i = 0;
        for (const sceneKey in sceneDictionary) {
            if (sceneTag == sceneDictionary[sceneKey].tag) {
                return i;
            }
            i++;
        }
        // Unable to find the given sceneTag, return -1
        return -1;
    };
    /**
     * [iOS Only]
     *
     * Resets the tracking of the AR session.
     *
     * @param resetTracking - determines if the tracking should be reset.
     * @param removeAnchors - determines if the existing anchors should be removed too.
     */
    _resetARSession = (resetTracking, removeAnchors) => {
        ViroARSceneNavigatorModule.resetARSession((0, react_native_1.findNodeHandle)(this), resetTracking, removeAnchors);
    };
    /**
     * [iOS/ARKit 1.5+ Only]
     *
     * Allows the developer to offset the current world orgin
     * by the given transformation matrix. ie. if this is called twice with the
     * position [0, 0, 1], then current world origin will be at [0, 0, 2] from its
     * initial position (it's additive, not meant to replace the existing origin)
     *
     * @param worldOrigin - a dictionary that can contain a `position` and `rotation` key with an
     *  array containing 3 floats (note: rotation is in degrees).
     */
    _setWorldOrigin = (worldOrigin) => {
        ViroARSceneNavigatorModule.setWorldOrigin((0, react_native_1.findNodeHandle)(this), worldOrigin);
    };
    /**
     * Renders the Scene Views in the stack.
     *
     * @returns Array of rendered Scene views.
     */
    _renderSceneStackItems = () => {
        let views = [];
        let i = 0;
        const { sceneDictionary } = this.state;
        for (const scene in sceneDictionary) {
            const Component = sceneDictionary[scene].sceneClass.scene;
            const props = sceneDictionary[scene].sceneClass.passProps;
            views.push(<Component key={"scene" + i} sceneNavigator={this.sceneNavigator} {...props} arSceneNavigator={this.arSceneNavigator} {...props}/>);
            i++;
        }
        return views;
    };
    arSceneNavigator = {
        push: this.push,
        pop: this.pop,
        popN: this.popN,
        jump: this.jump,
        replace: this.replace,
        startVideoRecording: this._startVideoRecording,
        stopVideoRecording: this._stopVideoRecording,
        takeScreenshot: this._takeScreenshot,
        resetARSession: this._resetARSession,
        setWorldOrigin: this._setWorldOrigin,
        project: this._project,
        unproject: this._unproject,
        viroAppProps: {},
    };
    sceneNavigator = {
        push: this.push,
        pop: this.pop,
        popN: this.popN,
        jump: this.jump,
        replace: this.replace,
        startVideoRecording: this._startVideoRecording,
        stopVideoRecording: this._stopVideoRecording,
        takeScreenshot: this._takeScreenshot,
        resetARSession: this._resetARSession,
        setWorldOrigin: this._setWorldOrigin,
        project: this._project,
        unproject: this._unproject,
        viroAppProps: {},
    };
    render() {
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroARSceneNavigator", this.props);
        const items = this._renderSceneStackItems();
        // update the arSceneNavigator with the latest given props on every render
        this.arSceneNavigator.viroAppProps = this.props.viroAppProps;
        this.sceneNavigator.viroAppProps = this.props.viroAppProps;
        // If the user simply passes us the props from the root React component,
        // then we'll have an extra 'rootTag' key which React automatically includes
        // so remove it.
        if (this.arSceneNavigator.viroAppProps?.rootTag) {
            delete this.arSceneNavigator.viroAppProps?.rootTag;
        }
        if (this.sceneNavigator.viroAppProps?.rootTag) {
            delete this.sceneNavigator.viroAppProps?.rootTag;
        }
        const { viroAppProps = {} } = this.props;
        return (<VRTARSceneNavigator ref={(component) => {
                this._component = component;
            }} {...this.props} viroAppProps={viroAppProps} currentSceneIndex={this.state.currentSceneIndex} style={(this.props.style, styles.container)}>
        {items}
      </VRTARSceneNavigator>);
    }
}
exports.ViroARSceneNavigator = ViroARSceneNavigator;
const styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
});
const VRTARSceneNavigator = (0, react_native_1.requireNativeComponent)("VRTARSceneNavigator", 
// @ts-ignore
ViroARSceneNavigator, {
    nativeOnly: { currentSceneIndex: true },
});
