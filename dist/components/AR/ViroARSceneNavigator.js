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
'use strict';
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_native_1 = require("react-native");
var react_1 = __importDefault(require("react"));
var prop_types_1 = __importDefault(require("prop-types"));
var NativeModules = require('react-native').NativeModules;
var createReactClass = require('create-react-class');
var ViroARSceneNavigatorModule = require('react-native').NativeModules.VRTARSceneNavigatorModule;
// type Scene = {
//   scene: Function;
//   passProps?: Object,
// };
var mathRandomOffset = 0;
/**
 * ViroARSceneNavigator is used to transition between multiple AR Scenes.
 */
var ViroARSceneNavigator = createReactClass({
    propTypes: __assign(__assign({}, react_native_1.View.propTypes), { 
        /**
         * ViroARSceneNavigator uses "scene" objects like the following to
         * describe a scene.
         */
        initialScene: prop_types_1.default.shape({
            /**
              * The React Class to render for this scene.
              */
            scene: prop_types_1.default.func.isRequired,
        }).isRequired, autofocus: prop_types_1.default.bool, 
        /**
         * iOS only props! Note: these props may change as the underlying platforms coalesce in features.
         */
        worldAlignment: prop_types_1.default.oneOf(['Gravity', 'GravityAndHeading', 'Camera']), videoQuality: prop_types_1.default.oneOf(['High', 'Low']), numberOfTrackedImages: prop_types_1.default.number, 
        /**
         * Renderer settings that can be used to enable or disable various
         * renderer capabilities and algorithms.
         */
        hdrEnabled: prop_types_1.default.bool, pbrEnabled: prop_types_1.default.bool, bloomEnabled: prop_types_1.default.bool, shadowsEnabled: prop_types_1.default.bool, multisamplingEnabled: prop_types_1.default.bool }),
    arSceneNavigator: (undef /*: ?Object*/),
    sceneNavigator: (undef /*: ?Object*/),
    getDefaultProps: function () {
        return {
            // Make sure viroAppProps aren't null to save us having to always check
            viroAppProps: {},
        };
    },
    UNSAFE_componentWillMount: function () {
        // Precompute a pack of callbacks that's frequently generated and passed to
        // instances.
        this.arSceneNavigator = {
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
        };
        this.sceneNavigator = {
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
        };
    },
    getInitialState: function () {
        var initialSceneTag = this.props.initialSceneKey;
        if (initialSceneTag == null) {
            initialSceneTag = this.getRandomTag();
        }
        var scene = {
            sceneClass: this.props.initialScene,
            tag: initialSceneTag,
            referenceCount: 1
        };
        var sceneDict = {};
        sceneDict[scene.tag] = scene;
        return {
            sceneDictionary: sceneDict,
            sceneHistory: [scene.tag],
            currentSceneIndex: 0,
        };
    },
    getRandomTag: function () {
        var randomTag = Math.random() + mathRandomOffset;
        mathRandomOffset++;
        return randomTag.toString();
    },
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
     */
    push: function (param1, param2) {
        var sceneKey = undefined;
        var scene = undefined;
        if (typeof param1 == 'string') {
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
        else if (scene == undefined && sceneKey != undefined
            && !(sceneKey in this.state.sceneDictionary)) {
            console.log("ERROR: Cannot push with a new sceneKey with no associated scene.");
            return;
        }
        if (sceneKey == undefined || (typeof sceneKey == 'string' && sceneKey.trim().length <= 0)) {
            sceneKey = this.getRandomTag();
        }
        this.incrementSceneReference(scene, sceneKey, false);
        this.addToHistory(sceneKey);
    },
    /**
     * Replace the top scene in the stack with the given scene. The remainder of the back
     * history is kept in the same order as before.
     *
     * Can take in either 1 or two parameters in the form:
     * replace ("sceneKey");
     * replace ("sceneKey", scene);
     * replace (scene);
     */
    replace: function (param1, param2) {
        var sceneKey = undefined;
        var scene = undefined;
        if (typeof param1 == 'string') {
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
        else if (scene == undefined && sceneKey != undefined
            && !(sceneKey in this.state.sceneDictionary)) {
            console.log("ERROR: Cannot replace with a new sceneKey with no associated scene.");
            return;
        }
        if (sceneKey == undefined || (typeof sceneKey == 'string' && sceneKey.trim().length <= 0)) {
            sceneKey = this.getRandomTag();
        }
        // Pop 1 off the scene history (do not use popN because in this case we allow
        // popping the root), then push this scene
        this.decrementReferenceForLastNScenes(1);
        this.popHistoryByN(1);
        this.incrementSceneReference(scene, sceneKey, false);
        this.addToHistory(sceneKey);
    },
    /**
     * Jumps to a given scene that had been previously pushed. If the scene was not pushed, we
     * then push and jump to it. The back history is re-ordered such that jumped to scenes are
     * re-ordered to the front. As such, only the back order of sequential jumps are preserved.
     *
     * Can take in either 1 or two parameters in the form:
     * jump ("sceneKey");
     * jump ("sceneKey", scene);
     * jump (scene);
     */
    jump: function (param1, param2) {
        var sceneKey = undefined;
        var scene = undefined;
        if (typeof param1 == 'string') {
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
        else if (scene == undefined && sceneKey != undefined
            && !(sceneKey in this.state.sceneDictionary)) {
            console.log("ERROR: Cannot jump with a new sceneKey with no associated scene.");
            return;
        }
        if (sceneKey == undefined || (typeof sceneKey == 'string' && sceneKey.trim().length <= 0)) {
            sceneKey = this.getRandomTag();
        }
        this.incrementSceneReference(scene, sceneKey, true);
        this.reorderHistory(sceneKey);
    },
    pop: function () {
        this.popN(1);
    },
    popN: function (n /*: number*/) {
        if (n === 0) {
            return;
        }
        if (this.state.sceneHistory.length - n <= 0) {
            console.log("WARN: Attempted to pop the root scene in ViroARSceneNavigator!");
            return;
        }
        this.decrementReferenceForLastNScenes(n);
        this.popHistoryByN(n);
    },
    /**
     * Increments the reference count for a scene within sceneDictionary that is
     * mapped to the given sceneKey. If no scenes are found / mapped, we create
     * one, initialize it with a reference count of 1, and store it within the
     * sceneDictionary for future reference.
     */
    incrementSceneReference: function (scene /*: Scene*/, scenekey /*: String*/, limitOne /*: Boolean*/) {
        var currentSceneDictionary = this.state.sceneDictionary;
        if (!(scenekey in currentSceneDictionary)) {
            var newScene = {
                sceneClass: scene,
                tag: scenekey,
                referenceCount: 0
            };
            currentSceneDictionary[scenekey] = newScene;
        }
        // Error out if there are no scenes matching the given sceneKey
        var currentScene = currentSceneDictionary[scenekey];
        if (currentScene == null || currentScene == "undefined") {
            console.log("ERROR: No scene found for: " + sceneKey);
            return;
        }
        // Update the scene's reference count and then the sceneDictionary
        if ((limitOne && currentScene.referenceCount < 1) || !limitOne) {
            currentScene.referenceCount++;
        }
        currentSceneDictionary[scenekey] = currentScene;
        // Finally update all states
        this.setState({
            sceneDictionary: currentSceneDictionary,
        });
    },
    /**
     * Decrements the reference count for the last N scenes within
     * the sceneHistory by 1. If nothing else references that given scene
     * (counts equals 0), we then remove that scene from sceneDictionary.
     */
    decrementReferenceForLastNScenes: function (n) {
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
            sceneDictionary: sceneDictionary
        });
    },
    /**
     * Adds the given sceneKey to the sceneHistory and updates the currentSceneIndex to point
     * to the scene on the top of the history stack (the most recent scene).
     */
    addToHistory: function (sceneKey /*: String*/) {
        var updatedHistory = this.state.sceneHistory.concat([sceneKey]);
        var currentIndex = this.getSceneIndex(sceneKey);
        this.setState({
            currentSceneIndex: currentIndex,
            sceneHistory: updatedHistory,
        });
    },
    /**
     * Instead of preserving history, we find the last pushed sceneKey within the history stack
     * matching the given sceneKey and re-order it to the front. We then update the
     * currentSceneIndex to point to the scene on the top of the history stack
     * (the most recent scene).
     */
    reorderHistory: function (sceneKey /*: String*/) {
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
    },
    popHistoryByN: function (n) {
        var sceneHistory = this.state.sceneHistory;
        sceneHistory.splice(sceneHistory.length - n, n);
        var currentIndex = this.getSceneIndex(sceneHistory[sceneHistory.length - 1]);
        // Finally update all states
        this.setState({
            currentSceneIndex: currentIndex,
            sceneHistory: sceneHistory,
        });
    },
    getSceneIndex: function (sceneTag) {
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
    },
    /*
     Starts recording video of the Viro renderer and external audio
  
     fileName - name of the file (without extension)
     saveToCameraRoll - whether or not the file should also be saved to the camera roll
     onError - callback function that accepts an errorCode.
     */
    _startVideoRecording: function (fileName, saveToCameraRoll, onError) {
        ViroARSceneNavigatorModule.startVideoRecording(react_native_1.findNodeHandle(this), fileName, saveToCameraRoll, onError);
    },
    /*
     Stops recording video of the Viro renderer
  
     returns Object w/ success, url and errorCode keys.
     */
    _stopVideoRecording: function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, ViroARSceneNavigatorModule.stopVideoRecording(react_native_1.findNodeHandle(this))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    },
    /*
     Takes a screenshot of the Viro renderer
  
     fileName - name of the file (without extension)
     saveToCameraRoll - whether or not the file should also be saved to the camera roll
  
     returns Object w/ success, url and errorCode keys.
     */
    _takeScreenshot: function (fileName, saveToCameraRoll) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, ViroARSceneNavigatorModule.takeScreenshot(react_native_1.findNodeHandle(this), fileName, saveToCameraRoll)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    },
    _project: function (point) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, ViroARSceneNavigatorModule.project(react_native_1.findNodeHandle(this), point)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    },
    _unproject: function (point) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, ViroARSceneNavigatorModule.unproject(react_native_1.findNodeHandle(this), point)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    },
    /*
     [iOS Only] Resets the tracking of the AR session.
  
     resetTracking - determines if the tracking should be reset.
     removeAnchors - determines if the existing anchors should be removed too.
     */
    _resetARSession: function (resetTracking, removeAnchors) {
        ViroARSceneNavigatorModule.resetARSession(react_native_1.findNodeHandle(this), resetTracking, removeAnchors);
    },
    /*
     [iOS/ARKit 1.5+ Only] Allows the developer to offset the current world orgin
     by the given transformation matrix. ie. if this is called twice with the
     position [0, 0, 1], then current world origin will be at [0, 0, 2] from its
     initial position (it's additive, not meant to replace the existing origin)
  
     worldOrigin - a dictionary that can contain a `position` and `rotation` key with
                   an array containing 3 floats (note: rotation is in degrees).
     */
    _setWorldOrigin: function (worldOrigin) {
        ViroARSceneNavigatorModule.setWorldOrigin(react_native_1.findNodeHandle(this), worldOrigin);
    },
    _renderSceneStackItems: function () {
        var views = [];
        var i = 0;
        var sceneDictionary = this.state.sceneDictionary;
        for (var scene in sceneDictionary) {
            var Component = sceneDictionary[scene].sceneClass.scene;
            var props = sceneDictionary[scene].sceneClass.passProps;
            views.push((<Component key={'scene' + i} sceneNavigator={this.sceneNavigator} {...props} arSceneNavigator={this.arSceneNavigator} {...props}/>));
            i++;
        }
        return views;
    },
    render: function () {
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroARSceneNavigator", this.props);
        var _this = this;
        var items = this._renderSceneStackItems();
        // update the arSceneNavigator with the latest given props on every render
        this.arSceneNavigator.viroAppProps = this.props.viroAppProps;
        this.sceneNavigator.viroAppProps = this.props.viroAppProps;
        // If the user simply passes us the props from the root React component,
        // then we'll have an extra 'rootTag' key which React automatically includes
        // so remove it.
        delete this.arSceneNavigator.viroAppProps.rootTag;
        delete this.sceneNavigator.viroAppProps.rootTag;
        return (<VRTARSceneNavigator ref={function (component) { _this._component = component; }} {...this.props} currentSceneIndex={this.state.currentSceneIndex} style={this.props.style, styles.container}>
        {items}
      </VRTARSceneNavigator>);
    },
});
var styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
var VRTARSceneNavigator = react_native_1.requireNativeComponent('VRTARSceneNavigator', ViroARSceneNavigator, {
    nativeOnly: { currentSceneIndex: true }
});
module.exports = ViroARSceneNavigator;
