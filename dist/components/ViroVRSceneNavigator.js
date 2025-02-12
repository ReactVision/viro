"use strict";
/**
 * Copyright (c) 2018-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroVRSceneNavigator
 * @flow
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
exports.ViroVRSceneNavigator = void 0;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
const ViroSceneNavigatorModule = react_native_1.NativeModules.VRTSceneNavigatorModule;
var mathRandomOffset = 0;
/**
 * ViroVRSceneNavigator is used to transition between multiple scenes.
 */
class ViroVRSceneNavigator extends React.Component {
    _component = null;
    /**
     * Called from native when either the user physically decides to exit vr (hits
     * the "X" buton).
     */
    _onExitViro(_event) {
        this.props.onExitViro && this.props.onExitViro();
    }
    constructor(props) {
        super(props);
        let initialSceneTag = props.initialSceneKey;
        if (initialSceneTag == null) {
            initialSceneTag = this.getRandomTag();
        }
        const scene = {
            sceneClass: props.initialScene,
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
    getRandomTag() {
        var randomTag = Math.random() + mathRandomOffset;
        mathRandomOffset++;
        return randomTag.toString();
    }
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
     * @todo: use Typescript function overloading rather than this inaccurate solution
     */
    push(param1, param2) {
        var sceneKey = undefined;
        var scene = undefined;
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
    }
    /**
     * Replace the top scene in the stack with the given scene. The remainder of the back
     * history is kept in the same order as before.
     *
     * Can take in either 1 or two parameters in the form:
     * replace ("sceneKey");
     * replace ("sceneKey", scene);
     * replace (scene);
     *
     * @todo: use Typescript function overloading rather than this inaccurate solution
     */
    replace(param1, param2) {
        var sceneKey = undefined;
        var scene = undefined;
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
    }
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
     * @todo: use Typescript function overloading rather than this inaccurate solution
     */
    jump(param1, param2) {
        var sceneKey = undefined;
        var scene = undefined;
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
    }
    pop() {
        this.popN(1);
    }
    popN(n) {
        if (n === 0) {
            return;
        }
        if (this.state.sceneHistory.length - n <= 0) {
            console.log("WARN: Attempted to pop the root scene in ViroSceneNavigator!");
            return;
        }
        this.decrementReferenceForLastNScenes(n);
        this.popHistoryByN(n);
    }
    /**
     * Increments the reference count for a scene within sceneDictionary that is
     * mapped to the given sceneKey. If no scenes are found / mapped, we create
     * one, initialize it with a reference count of 1, and store it within the
     * sceneDictionary for future reference.
     */
    incrementSceneReference(scene, sceneKey, limitOne) {
        var currentSceneDictionary = this.state.sceneDictionary;
        if (!(sceneKey in currentSceneDictionary)) {
            var newScene = {
                sceneClass: scene,
                tag: sceneKey,
                referenceCount: 0,
            };
            currentSceneDictionary[sceneKey] = newScene;
        }
        // Error out if there are no scenes matching the given sceneKey
        var currentScene = currentSceneDictionary[sceneKey];
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
    }
    /**
     * Decrements the reference count for the last N scenes within
     * the sceneHistory by 1. If nothing else references that given scene
     * (counts equals 0), we then remove that scene from sceneDictionary.
     */
    decrementReferenceForLastNScenes(n) {
        var sceneHistory = this.state.sceneHistory;
        var sceneDictionary = this.state.sceneDictionary;
        // Now update and release any reference counts
        for (var i = 1; i <= n; i++) {
            var sceneTag = sceneHistory[sceneHistory.length - i];
            var scene = sceneDictionary[sceneTag];
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
    }
    /**
     * Adds the given sceneKey to the sceneHistory and updates the currentSceneIndex to point
     * to the scene on the top of the history stack (the most recent scene).
     */
    addToHistory(sceneKey) {
        var updatedHistory = this.state.sceneHistory.concat([sceneKey]);
        var currentIndex = this.getSceneIndex(sceneKey);
        this.setState({
            currentSceneIndex: currentIndex,
            sceneHistory: updatedHistory,
        });
    }
    /**
     * Instead of preserving history, we find the last pushed sceneKey within the history stack
     * matching the given sceneKey and re-order it to the front. We then update the
     * currentSceneIndex to point to the scene on the top of the history stack
     * (the most recent scene).
     */
    reorderHistory(sceneKey) {
        // Find the last sceneKey within sceneHistory and remove it.
        var sceneHistory = this.state.sceneHistory;
        for (var i = sceneHistory.length - 1; i >= 0; i--) {
            if (sceneKey == sceneHistory[i]) {
                sceneHistory.splice(i, 1);
                break;
            }
        }
        // Add back the sceneKey to the front of the History stack.
        var updatedHistory = sceneHistory.concat([sceneKey]);
        var currentIndex = this.getSceneIndex(sceneKey);
        this.setState({
            currentSceneIndex: currentIndex,
            sceneHistory: updatedHistory,
        });
    }
    popHistoryByN(n) {
        var sceneHistory = this.state.sceneHistory;
        sceneHistory.splice(sceneHistory.length - n, n);
        var currentIndex = this.getSceneIndex(sceneHistory[sceneHistory.length - 1]);
        // Finally update all states
        this.setState({
            currentSceneIndex: currentIndex,
            sceneHistory: sceneHistory,
        });
    }
    getSceneIndex(sceneTag) {
        var sceneDictionary = this.state.sceneDictionary;
        var i = 0;
        for (var sceneKey in sceneDictionary) {
            if (sceneTag == sceneDictionary[sceneKey].tag) {
                return i;
            }
            i++;
        }
        // Unable to find the given sceneTag, return -1
        return -1;
    }
    _recenterTracking() {
        ViroSceneNavigatorModule.recenterTracking((0, react_native_1.findNodeHandle)(this));
    }
    async _project(point) {
        return await ViroSceneNavigatorModule.project((0, react_native_1.findNodeHandle)(this), point);
    }
    async _unproject(point) {
        return await ViroSceneNavigatorModule.unproject((0, react_native_1.findNodeHandle)(this), point);
    }
    _renderSceneStackItems() {
        let views = [];
        var i = 0;
        var sceneDictionary = this.state.sceneDictionary;
        for (var scene in sceneDictionary) {
            var Scene = sceneDictionary[scene].sceneClass.scene;
            var props = sceneDictionary[scene].sceneClass.passProps;
            views.push(<Scene key={"scene" + i} sceneNavigator={this.sceneNavigator} {...props}/>);
            i++;
        }
        return views;
    }
    sceneNavigator = {
        push: this.push,
        pop: this.pop,
        popN: this.popN,
        jump: this.jump,
        replace: this.replace,
        // exitViro: this.exitViro, // not defined?
        project: this._project,
        unproject: this._unproject,
        recenterTracking: this._recenterTracking,
        viroAppProps: {},
    };
    render() {
        const items = this._renderSceneStackItems();
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroVRSceneNavigator", this.props)
        // update the sceneNavigator with the latest given props on every render
        this.sceneNavigator.viroAppProps = this.props.viroAppProps;
        // If the user simply passes us the props from the root React component,
        // then we'll have an extra 'rootTag' key which React automatically includes
        // so remove it.
        if (this.sceneNavigator.viroAppProps?.rootTag) {
            delete this.sceneNavigator.viroAppProps?.rootTag;
        }
        const { viroAppProps = {} } = this.props;
        return (<VRTVRSceneNavigator ref={(component) => {
                this._component = component;
            }} {...this.props} viroAppProps={viroAppProps} currentSceneIndex={this.state.currentSceneIndex} style={(this.props.style, styles.container)} hasOnExitViroCallback={this.props.onExitViro != undefined} onExitViro={this._onExitViro}>
        {items}
      </VRTVRSceneNavigator>);
    }
}
exports.ViroVRSceneNavigator = ViroVRSceneNavigator;
var styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
});
var VRTVRSceneNavigator = (0, react_native_1.requireNativeComponent)("VRTVRSceneNavigator", 
// @ts-ignore
ViroVRSceneNavigator, {
    nativeOnly: {
        currentSceneIndex: true,
        onExitViro: true,
        hasOnExitViroCallback: true,
    },
});
