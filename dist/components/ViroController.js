/**
 * Copyright (c) 2015-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroController = void 0;
const React = __importStar(require("react"));
const react_native_1 = require("react-native");
const react_native_2 = require("react-native");
const ViroEvents_1 = require("./Types/ViroEvents");
const ViroControllerModule = react_native_2.NativeModules.VRTControllerModule;
class ViroController extends React.Component {
    _component = null;
    _onClick(event) {
        this.props.onClick &&
            this.props.onClick(event.nativeEvent.position, event.nativeEvent.source);
    }
    _onClickState(event) {
        this.props.onClickState &&
            this.props.onClickState(event.nativeEvent.clickState, event.nativeEvent.position, event.nativeEvent.source);
        let CLICKED = ViroEvents_1.ViroClickStateTypes.CLICKED; // Value representation of Clicked ClickState within EventDelegateJni.
        if (event.nativeEvent.clickState == CLICKED) {
            this._onClick(event);
        }
    }
    _onTouch(event) {
        this.props.onTouch &&
            this.props.onTouch(event.nativeEvent.touchState, event.nativeEvent.touchPos, event.nativeEvent.source);
    }
    _onScroll(event) {
        this.props.onScroll &&
            this.props.onScroll(event.nativeEvent.scrollPos, event.nativeEvent.source);
    }
    _onSwipe(event) {
        this.props.onSwipe &&
            this.props.onSwipe(event.nativeEvent.swipeState, event.nativeEvent.source);
    }
    _onControllerStatus(event) {
        this.props.onControllerStatus &&
            this.props.onControllerStatus(event.nativeEvent.controllerStatus, event.nativeEvent.source);
    }
    _onFuse = (event) => {
        if (this.props.onFuse) {
            if (typeof this.props.onFuse === "function") {
                this.props.onFuse(event.nativeEvent.source);
            }
            else if (this.props.onFuse?.callback) {
                this.props.onFuse.callback(event.nativeEvent.source);
            }
        }
    };
    _onPinch(event) {
        this.props.onPinch &&
            this.props.onPinch(event.nativeEvent.pinchState, event.nativeEvent.scaleFactor, event.nativeEvent.source);
    }
    _onRotate(event) {
        this.props.onRotate &&
            this.props.onRotate(event.nativeEvent.rotateState, event.nativeEvent.rotationFactor, event.nativeEvent.source);
    }
    async getControllerForwardAsync() {
        return await ViroControllerModule.getForwardVectorAsync((0, react_native_1.findNodeHandle)(this));
    }
    setNativeProps(nativeProps) {
        this._component?.setNativeProps(nativeProps);
    }
    _onDrag(event) {
        this.props.onDrag &&
            this.props.onDrag(event.nativeEvent.dragToPos, event.nativeEvent.source);
    }
    render() {
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroController", this.props);
        return (<VRTController {...this.props} ref={(component) => {
                this._component = component;
            }} canClick={this.props.onClick != undefined ||
                this.props.onClickState != undefined} canTouch={this.props.onTouch != undefined} canScroll={this.props.onScroll != undefined} canSwipe={this.props.onSwipe != undefined} canGetControllerStatus={this.props.onControllerStatus != undefined} canDrag={this.props.onDrag != undefined} canPinch={this.props.onPinch != undefined} canRotate={this.props.onRotate != undefined} canFuse={this.props.onFuse != undefined} onClickViro={this._onClickState} onTouchViro={this._onTouch} onScrollViro={this._onScroll} onSwipeViro={this._onSwipe} onDragViro={this._onDrag} onPinchViro={this._onPinch} onRotateViro={this._onRotate} onFuseViro={this._onFuse} onControllerStatusViro={this._onControllerStatus}/>);
    }
}
exports.ViroController = ViroController;
var VRTController = (0, react_native_1.requireNativeComponent)("VRTController", 
// @ts-ignore
ViroController, {
    nativeOnly: {
        canClick: true,
        canTouch: true,
        canScroll: true,
        canSwipe: true,
        canDrag: true,
        canPinch: true,
        canRotate: true,
        canFuse: true,
        canGetControllerStatus: true,
        onClickViro: true,
        onTouchViro: true,
        onScrollViro: true,
        onSwipeViro: true,
        onControllerStatusViro: true,
        onDragViro: true,
        onPinchViro: true,
        onRotateViro: true,
        onFuseViro: true,
        timeToFuse: true,
    },
});
