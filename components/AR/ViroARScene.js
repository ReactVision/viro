"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroARScene = void 0;
/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
const ViroSceneContext_1 = require("../ViroSceneContext");
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
// @ts-ignore
const resolveAssetSource_1 = __importDefault(require("react-native/Libraries/Image/resolveAssetSource"));
const ViroBase_1 = require("../ViroBase");
const ViroConstants_1 = require("../ViroConstants");
const ViroCameraModule = react_native_1.NativeModules.ViroCameraModule;
class ViroARScene extends ViroBase_1.ViroBase {
    onTrackingFirstInitialized = false;
    _onCameraARHitTest = (event) => {
        var hitTestEventObj = {
            hitTestResults: event.nativeEvent.hitTestResults,
            cameraOrientation: {
                position: [
                    event.nativeEvent.cameraOrientation[0],
                    event.nativeEvent.cameraOrientation[1],
                    event.nativeEvent.cameraOrientation[2],
                ],
                rotation: [
                    event.nativeEvent.cameraOrientation[3],
                    event.nativeEvent.cameraOrientation[4],
                    event.nativeEvent.cameraOrientation[5],
                ],
                forward: [
                    event.nativeEvent.cameraOrientation[6],
                    event.nativeEvent.cameraOrientation[7],
                    event.nativeEvent.cameraOrientation[8],
                ],
                up: [
                    event.nativeEvent.cameraOrientation[9],
                    event.nativeEvent.cameraOrientation[10],
                    event.nativeEvent.cameraOrientation[11],
                ],
            },
        };
        this.props.onCameraARHitTest &&
            this.props.onCameraARHitTest(hitTestEventObj);
    };
    _onARPointCloudUpdate = (event) => {
        this.props.onARPointCloudUpdate &&
            this.props.onARPointCloudUpdate(event.nativeEvent.pointCloud);
    };
    _onCameraTransformUpdate = (event) => {
        var cameraTransform = {
            // ** DEPRECATION WARNING ** The cameraTransform key will be deprecated in a future release,
            cameraTransform: {
                position: [
                    event.nativeEvent.cameraTransform[0],
                    event.nativeEvent.cameraTransform[1],
                    event.nativeEvent.cameraTransform[2],
                ],
                rotation: [
                    event.nativeEvent.cameraTransform[3],
                    event.nativeEvent.cameraTransform[4],
                    event.nativeEvent.cameraTransform[5],
                ],
                forward: [
                    event.nativeEvent.cameraTransform[6],
                    event.nativeEvent.cameraTransform[7],
                    event.nativeEvent.cameraTransform[8],
                ],
                up: [
                    event.nativeEvent.cameraTransform[9],
                    event.nativeEvent.cameraTransform[10],
                    event.nativeEvent.cameraTransform[11],
                ],
            },
            position: [
                event.nativeEvent.cameraTransform[0],
                event.nativeEvent.cameraTransform[1],
                event.nativeEvent.cameraTransform[2],
            ],
            rotation: [
                event.nativeEvent.cameraTransform[3],
                event.nativeEvent.cameraTransform[4],
                event.nativeEvent.cameraTransform[5],
            ],
            forward: [
                event.nativeEvent.cameraTransform[6],
                event.nativeEvent.cameraTransform[7],
                event.nativeEvent.cameraTransform[8],
            ],
            up: [
                event.nativeEvent.cameraTransform[9],
                event.nativeEvent.cameraTransform[10],
                event.nativeEvent.cameraTransform[11],
            ],
        };
        this.props.onCameraTransformUpdate &&
            this.props.onCameraTransformUpdate(cameraTransform);
    };
    _onPlatformUpdate = (event) => {
        this.props.onPlatformUpdate &&
            this.props.onPlatformUpdate(event.nativeEvent.platformInfoViro);
    };
    // TODO VIRO-3172: Remove in favor of deprecating onTrackingInitialized
    componentDidMount() {
        this.onTrackingFirstInitialized = false;
    }
    _onTrackingUpdated = (event) => {
        if (this.props.onTrackingUpdated) {
            this.props.onTrackingUpdated(event.nativeEvent.state, event.nativeEvent.reason);
        }
        // TODO VIRO-3172: Remove in favor of deprecating onTrackingInitialized
        if ((event.nativeEvent.state == ViroConstants_1.ViroTrackingStateConstants.TRACKING_LIMITED ||
            event.nativeEvent.state ==
                ViroConstants_1.ViroTrackingStateConstants.TRACKING_NORMAL) &&
            !this.onTrackingFirstInitialized) {
            this.onTrackingFirstInitialized = true;
            if (this.props.onTrackingInitialized) {
                this.props.onTrackingInitialized();
            }
        }
    };
    /**
     * ##### DEPRECATION WARNING - this prop may be removed in future releases #####
     * @deprecated
     */
    _onTrackingInitialized = (_event) => {
        this.props.onTrackingInitialized && this.props.onTrackingInitialized();
    };
    /**
     * Gives constant estimates of the ambient light as detected by the camera.
     * Returns object w/ "intensity" and "color" keys
     */
    _onAmbientLightUpdate = (event) => {
        this.props.onAmbientLightUpdate &&
            this.props.onAmbientLightUpdate(event.nativeEvent.ambientLightInfo);
    };
    _onAnchorFound = (event) => {
        // TODO: this is in a different format than the other onAnchorFound methods
        this.props.onAnchorFound &&
            this.props.onAnchorFound(event.nativeEvent.anchor);
    };
    _onAnchorUpdated = (event) => {
        // TODO: this is in a different format than the other onAnchorUpdated methods
        this.props.onAnchorUpdated &&
            this.props.onAnchorUpdated(event.nativeEvent.anchor);
    };
    _onAnchorRemoved = (event) => {
        // TODO: this is in a different format than the other onAnchorRemoved methods
        this.props.onAnchorRemoved &&
            this.props.onAnchorRemoved(event.nativeEvent.anchor);
    };
    findCollisionsWithRayAsync = async (from, to, closest, viroTag) => {
        return await react_native_1.NativeModules.VRTSceneModule.findCollisionsWithRayAsync((0, react_native_1.findNodeHandle)(this), from, to, closest, viroTag);
    };
    findCollisionsWithShapeAsync = async (from, to, shapeString, shapeParam, viroTag) => {
        return await react_native_1.NativeModules.VRTSceneModule.findCollisionsWithShapeAsync((0, react_native_1.findNodeHandle)(this), from, to, shapeString, shapeParam, viroTag);
    };
    performARHitTestWithRay = async (ray) => {
        return await react_native_1.NativeModules.VRTARSceneModule.performARHitTestWithRay((0, react_native_1.findNodeHandle)(this), ray);
    };
    performARHitTestWithWorldPoints = async (origin, destination) => {
        return await react_native_1.NativeModules.VRTARSceneModule.performARHitTestWithRay((0, react_native_1.findNodeHandle)(this), origin, destination);
    };
    performARHitTestWithPosition = async (position) => {
        return await react_native_1.NativeModules.VRTARSceneModule.performARHitTestWithPosition((0, react_native_1.findNodeHandle)(this), position);
    };
    performARHitTestWithPoint = async (x, y) => {
        return await react_native_1.NativeModules.VRTARSceneModule.performARHitTestWithPoint((0, react_native_1.findNodeHandle)(this), x, y);
    };
    /**
     * ##### DEPRECATION WARNING - this prop may be removed in future releases #####
     * @deprecated
     */
    // getCameraPositionAsync = async () => {
    //   console.warn(
    //     "[Viro] ViroScene.getCameraPositionAsync has been DEPRECATED. Please use getCameraOrientationAsync instead."
    //   );
    //   var orientation = await NativeModules.VRTCameraModule.getCameraOrientation(
    //     findNodeHandle(this)
    //   );
    //   var position = [orientation[0], orientation[1], orientation[2]];
    //   return position;
    // }
    getCameraOrientationAsync = async () => {
        var orientation = await react_native_1.NativeModules.VRTCameraModule.getCameraOrientation((0, react_native_1.findNodeHandle)(this));
        return {
            position: [orientation[0], orientation[1], orientation[2]],
            rotation: [orientation[3], orientation[4], orientation[5]],
            forward: [orientation[6], orientation[7], orientation[8]],
            up: [orientation[9], orientation[10], orientation[11]],
        };
    };
    getCameraPositionAsync = async () => {
        // TODO: Two functions with the same name??
        return await ViroCameraModule.getCameraPosition((0, react_native_1.findNodeHandle)(this));
    };
    render() {
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroARScene", this.props);
        // Since anchorDetectionTypes can be either a string or an array, convert the string to a 1-element array.
        let anchorDetectionTypes = typeof this.props.anchorDetectionTypes === "string"
            ? new Array(this.props.anchorDetectionTypes)
            : this.props.anchorDetectionTypes;
        let timeToFuse = undefined;
        if (this.props.onFuse != undefined &&
            typeof this.props.onFuse === "object") {
            timeToFuse = this.props.onFuse.timeToFuse;
        }
        let displayPointCloud = false;
        let pointCloudImage = undefined;
        let pointCloudScale = undefined;
        let pointCloudMaxPoints = undefined;
        // parse out displayPointCloud prop
        if (this.props.displayPointCloud) {
            displayPointCloud = true;
            pointCloudImage = (0, resolveAssetSource_1.default)(this.props.displayPointCloud.imageSource);
            pointCloudScale = this.props.displayPointCloud.imageScale;
            pointCloudMaxPoints = this.props.displayPointCloud.maxPoints;
        }
        if (this.props.onTrackingInitialized && !this.onTrackingFirstInitialized) {
            console.warn("[Viro] ViroARScene.onTrackingInitialized() has been DEPRECATED. Please use onTrackingUpdated() instead.");
        }
        return (<ViroSceneContext_1.ViroSceneContext.Provider value={{
                cameraDidMount: (camera) => {
                    if (camera.props.active) {
                        react_native_1.NativeModules.VRTCameraModule.setSceneCamera((0, react_native_1.findNodeHandle)(this), (0, react_native_1.findNodeHandle)(camera));
                    }
                },
                cameraWillUnmount: (camera) => {
                    if (camera.props.active) {
                        react_native_1.NativeModules.VRTCameraModule.removeSceneCamera((0, react_native_1.findNodeHandle)(this), (0, react_native_1.findNodeHandle)(camera));
                    }
                },
                cameraDidUpdate: (camera, active) => {
                    if (active) {
                        react_native_1.NativeModules.VRTCameraModule.setSceneCamera((0, react_native_1.findNodeHandle)(this), (0, react_native_1.findNodeHandle)(camera));
                    }
                    else {
                        react_native_1.NativeModules.VRTCameraModule.removeSceneCamera((0, react_native_1.findNodeHandle)(this), (0, react_native_1.findNodeHandle)(camera));
                    }
                },
            }}>
        <VRTARScene {...this.props} canHover={this.props.onHover != undefined} canClick={this.props.onClick != undefined ||
                this.props.onClickState != undefined} canTouch={this.props.onTouch != undefined} canScroll={this.props.onScroll != undefined} canSwipe={this.props.onSwipe != undefined} canDrag={this.props.onDrag != undefined} canPinch={this.props.onPinch != undefined} canRotate={this.props.onRotate != undefined} canFuse={this.props.onFuse != undefined} canCameraARHitTest={this.props.onCameraARHitTest != undefined} canARPointCloudUpdate={this.props.onARPointCloudUpdate != undefined} canCameraTransformUpdate={this.props.onCameraTransformUpdate != undefined} onHoverViro={this._onHover} onClickViro={this._onClickState} onTouchViro={this._onTouch} onScrollViro={this._onScroll} onSwipeViro={this._onSwipe} onDragViro={this._onDrag} onPinchViro={this._onPinch} onRotateViro={this._onRotate} onFuseViro={this._onFuse} onCameraARHitTestViro={this._onCameraARHitTest} onARPointCloudUpdateViro={this._onARPointCloudUpdate} onCameraTransformUpdateViro={this._onCameraTransformUpdate} onPlatformUpdateViro={this._onPlatformUpdate} onTrackingUpdatedViro={this._onTrackingUpdated} onAmbientLightUpdateViro={this._onAmbientLightUpdate} onAnchorFoundViro={this._onAnchorFound} onAnchorUpdatedViro={this._onAnchorUpdated} onAnchorRemovedViro={this._onAnchorRemoved} timeToFuse={timeToFuse} anchorDetectionTypes={anchorDetectionTypes} displayPointCloud={displayPointCloud} pointCloudImage={pointCloudImage} pointCloudScale={pointCloudScale} pointCloudMaxPoints={pointCloudMaxPoints}/>
      </ViroSceneContext_1.ViroSceneContext.Provider>);
    }
}
exports.ViroARScene = ViroARScene;
var VRTARScene = (0, react_native_1.requireNativeComponent)("VRTARScene", 
// @ts-ignore
ViroARScene, {
    nativeOnly: {
        canHover: true,
        canClick: true,
        canTouch: true,
        canScroll: true,
        canSwipe: true,
        canDrag: true,
        canPinch: true,
        canRotate: true,
        canFuse: true,
        canCameraARHitTest: true,
        canARPointCloudUpdate: true,
        canCameraTransformUpdate: true,
        onHoverViro: true,
        onClickViro: true,
        onTouchViro: true,
        onScrollViro: true,
        onSwipeViro: true,
        onDragViro: true,
        onPinchViro: true,
        onRotateViro: true,
        onFuseViro: true,
        onPlatformUpdateViro: true,
        onTrackingInitializedViro: true,
        onTrackingUpdatedViro: true,
        onAmbientLightUpdateViro: true,
        onAnchorFoundViro: true,
        onAnchorUpdatedViro: true,
        onAnchorRemovedViro: true,
        onCameraARHitTestViro: true,
        onARPointCloudUpdateViro: true,
        onCameraTransformUpdateViro: true,
        timeToFuse: true,
        pointCloudImage: true,
        pointCloudScale: true,
        pointCloudMaxPoints: true,
    },
});
