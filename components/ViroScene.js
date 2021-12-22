"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroScene = void 0;
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
const ViroBase_1 = require("./ViroBase");
class ViroScene extends ViroBase_1.ViroBase {
    _onPlatformUpdate(event) {
        /**
         * ##### DEPRECATION WARNING - 'vrPlatform' is deprecated in favor of 'platform'! Support
         * for 'vrPlatform' may be removed in the future.
         */
        event.nativeEvent.platformInfoViro.vrPlatform =
            event.nativeEvent.platformInfoViro.platform;
        this.props.onPlatformUpdate &&
            this.props.onPlatformUpdate(event.nativeEvent.platformInfoViro);
    }
    _onCameraTransformUpdate(event) {
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
    }
    // TODO: types for closest
    async findCollisionsWithRayAsync(from, to, closest, viroTag) {
        return await react_native_1.NativeModules.VRTSceneModule.findCollisionsWithRayAsync(react_native_1.findNodeHandle(this), from, to, closest, viroTag);
    }
    async findCollisionsWithShapeAsync(from, to, shapeString, shapeParam, viroTag) {
        return await react_native_1.NativeModules.VRTSceneModule.findCollisionsWithShapeAsync(react_native_1.findNodeHandle(this), from, to, shapeString, shapeParam, viroTag);
    }
    /**
     * ##### DEPRECATION WARNING - this prop may be removed in future releases #####
     * @deprecated
     */
    async getCameraPositionAsync() {
        console.warn("[Viro] ViroScene.getCameraPositionAsync has been DEPRECATED. Please use getCameraOrientationAsync instead.");
        var orientation = await react_native_1.NativeModules.VRTCameraModule.getCameraOrientation(react_native_1.findNodeHandle(this));
        var position = [orientation[0], orientation[1], orientation[2]];
        return position;
    }
    async getCameraOrientationAsync() {
        var orientation = await react_native_1.NativeModules.VRTCameraModule.getCameraOrientation(react_native_1.findNodeHandle(this));
        return {
            position: [orientation[0], orientation[1], orientation[2]],
            rotation: [orientation[3], orientation[4], orientation[5]],
            forward: [orientation[6], orientation[7], orientation[8]],
            up: [orientation[9], orientation[10], orientation[11]],
        };
    }
    getChildContext() {
        return {
            cameraDidMount: (camera) => {
                if (camera.props.active) {
                    react_native_1.NativeModules.VRTCameraModule.setSceneCamera(react_native_1.findNodeHandle(this), react_native_1.findNodeHandle(camera));
                }
            },
            cameraWillUnmount: (camera) => {
                if (camera.props.active) {
                    react_native_1.NativeModules.VRTCameraModule.removeSceneCamera(react_native_1.findNodeHandle(this), react_native_1.findNodeHandle(camera));
                }
            },
            cameraDidUpdate: (camera, active) => {
                if (active) {
                    react_native_1.NativeModules.VRTCameraModule.setSceneCamera(react_native_1.findNodeHandle(this), react_native_1.findNodeHandle(camera));
                }
                else {
                    react_native_1.NativeModules.VRTCameraModule.removeSceneCamera(react_native_1.findNodeHandle(this), react_native_1.findNodeHandle(camera));
                }
            },
        };
    }
    render() {
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroScene", this.props);
        let timeToFuse = undefined;
        if (this.props.onFuse != undefined &&
            typeof this.props.onFuse === "object") {
            timeToFuse = this.props.onFuse.timeToFuse;
        }
        return (<VRTScene {...this.props} ref={(component) => {
                this._component = component;
            }} canHover={this.props.onHover != undefined} canClick={this.props.onClick != undefined ||
                this.props.onClickState != undefined} canTouch={this.props.onTouch != undefined} canScroll={this.props.onScroll != undefined} canSwipe={this.props.onSwipe != undefined} canFuse={this.props.onFuse != undefined} canDrag={this.props.onDrag != undefined} canPinch={this.props.onPinch != undefined} canRotate={this.props.onRotate != undefined} canCameraTransformUpdate={this.props.onCameraTransformUpdate != undefined} onHoverViro={this._onHover} onClickViro={this._onClickState} onTouchViro={this._onTouch} onScrollViro={this._onScroll} onSwipeViro={this._onSwipe} onFuseViro={this._onFuse} onDragViro={this._onDrag} onRotateViro={this._onRotate} onPinchViro={this._onPinch} onPlatformUpdateViro={this._onPlatformUpdate} onCameraTransformUpdateViro={this._onCameraTransformUpdate} timeToFuse={timeToFuse}/>);
    }
}
exports.ViroScene = ViroScene;
var VRTScene = react_native_1.requireNativeComponent("VRTScene", 
// @ts-ignore
ViroScene, {
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
        canCollide: true,
        canCameraTransformUpdate: true,
        onHoverViro: true,
        onClickViro: true,
        onTouchViro: true,
        onScrollViro: true,
        onSwipeViro: true,
        onDragViro: true,
        onPinchViro: true,
        onRotateViro: true,
        onPlatformUpdateViro: true,
        onCameraTransformUpdateViro: true,
        onFuseViro: true,
        timeToFuse: true,
        physicsBody: true,
        onCollisionViro: true,
    },
});
