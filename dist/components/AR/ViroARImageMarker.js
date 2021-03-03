/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroARImageMarker
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_native_1 = require("react-native");
var react_1 = __importDefault(require("react"));
var prop_types_1 = __importDefault(require("prop-types"));
var createReactClass = require('create-react-class');
/**
 * Container for Viro Components anchored to a detected image.
 */
var ViroARImageMarker = createReactClass({
    propTypes: __assign(__assign({}, react_native_1.View.propTypes), { target: prop_types_1.default.string, pauseUpdates: prop_types_1.default.bool, renderingOrder: prop_types_1.default.number, visible: prop_types_1.default.bool, opacity: prop_types_1.default.number, ignoreEventHandling: prop_types_1.default.bool, dragType: prop_types_1.default.oneOf(["FixedDistance", "FixedDistanceOrigin", "FixedToWorld", "FixedToPlane"]), dragPlane: prop_types_1.default.shape({
            planePoint: prop_types_1.default.arrayOf(prop_types_1.default.number),
            planeNormal: prop_types_1.default.arrayOf(prop_types_1.default.number),
            maxDistance: prop_types_1.default.number
        }), onHover: prop_types_1.default.func, onClick: prop_types_1.default.func, onClickState: prop_types_1.default.func, onTouch: prop_types_1.default.func, onScroll: prop_types_1.default.func, onSwipe: prop_types_1.default.func, onDrag: prop_types_1.default.func, onPinch: prop_types_1.default.func, onRotate: prop_types_1.default.func, onFuse: prop_types_1.default.oneOfType([
            prop_types_1.default.shape({
                callback: prop_types_1.default.func.isRequired,
                timeToFuse: prop_types_1.default.number
            }),
            prop_types_1.default.func
        ]), onCollision: prop_types_1.default.func, viroTag: prop_types_1.default.string, onAnchorFound: prop_types_1.default.func, onAnchorUpdated: prop_types_1.default.func, onAnchorRemoved: prop_types_1.default.func }),
    _onHover: function (event /*: Event*/) {
        this.props.onHover && this.props.onHover(event.nativeEvent.isHovering, event.nativeEvent.position, event.nativeEvent.source);
    },
    _onClick: function (event /*: Event*/) {
        this.props.onClick && this.props.onClick(event.nativeEvent.position, event.nativeEvent.source);
    },
    _onClickState: function (event /*: Event*/) {
        this.props.onClickState && this.props.onClickState(event.nativeEvent.clickState, event.nativeEvent.position, event.nativeEvent.source);
        var CLICKED = 3; // Value representation of Clicked ClickState within EventDelegateJni.
        if (event.nativeEvent.clickState == CLICKED) {
            this._onClick(event);
        }
    },
    _onTouch: function (event /*: Event*/) {
        this.props.onTouch && this.props.onTouch(event.nativeEvent.touchState, event.nativeEvent.touchPos, event.nativeEvent.source);
    },
    _onScroll: function (event /*: Event*/) {
        this.props.onScroll && this.props.onScroll(event.nativeEvent.scrollPos, event.nativeEvent.source);
    },
    _onSwipe: function (event /*: Event*/) {
        this.props.onSwipe && this.props.onSwipe(event.nativeEvent.swipeState, event.nativeEvent.source);
    },
    _onDrag: function (event /*: Event*/) {
        this.props.onDrag
            && this.props.onDrag(event.nativeEvent.dragToPos, event.nativeEvent.source);
    },
    _onPinch: function (event /*: Event*/) {
        this.props.onPinch && this.props.onPinch(event.nativeEvent.pinchState, event.nativeEvent.scaleFactor, event.nativeEvent.source);
    },
    _onRotate: function (event /*: Event*/) {
        this.props.onRotate && this.props.onRotate(event.nativeEvent.rotateState, event.nativeEvent.rotationFactor, event.nativeEvent.source);
    },
    _onFuse: function (event /*: Event*/) {
        if (this.props.onFuse) {
            if (typeof this.props.onFuse === 'function') {
                this.props.onFuse(event.nativeEvent.source);
            }
            else if (this.props.onFuse != undefined && this.props.onFuse.callback != undefined) {
                this.props.onFuse.callback(event.nativeEvent.source);
            }
        }
    },
    _onCollision: function (event /*: Event*/) {
        if (this.props.onCollision) {
            this.props.onCollision(event.nativeEvent.viroTag, event.nativeEvent.collidedPoint, event.nativeEvent.collidedNormal);
        }
    },
    _onAnchorFound: function (event /*: Event*/) {
        if (this.props.onAnchorFound) {
            this.props.onAnchorFound(event.nativeEvent.anchorFoundMap);
        }
    },
    _onAnchorUpdated: function (event /*: Event*/) {
        if (this.props.onAnchorUpdated) {
            this.props.onAnchorUpdated(event.nativeEvent.anchorUpdatedMap);
        }
    },
    _onAnchorRemoved: function (event /*: Event*/) {
        if (this.props.onAnchorRemoved) {
            this.props.onAnchorRemoved();
        }
    },
    setNativeProps: function (nativeProps) {
        this._component.setNativeProps(nativeProps);
    },
    render: function () {
        // Uncomment this line to check for misnamed props
        //checkMisnamedProps("ViroARImageMarker", this.props);
        var _this = this;
        var timeToFuse = undefined;
        if (this.props.onFuse != undefined && typeof this.props.onFuse === 'object') {
            timeToFuse = this.props.onFuse.timeToFuse;
        }
        return (<VRTARImageMarker {...this.props} ref={function (component) { _this._component = component; }} canHover={this.props.onHover != undefined} canClick={this.props.onClick != undefined || this.props.onClickState != undefined} canTouch={this.props.onTouch != undefined} canScroll={this.props.onScroll != undefined} canSwipe={this.props.onSwipe != undefined} canDrag={this.props.onDrag != undefined} canPinch={this.props.onPinch != undefined} canRotate={this.props.onRotate != undefined} canFuse={this.props.onFuse != undefined} onHoverViro={this._onHover} onClickViro={this._onClickState} onTouchViro={this._onTouch} onScrollViro={this._onScroll} onSwipeViro={this._onSwipe} onDragViro={this._onDrag} onPinchViro={this._onPinch} onRotateViro={this._onRotate} onFuseViro={this._onFuse} timeToFuse={timeToFuse} canCollide={this.props.onCollision != undefined} onCollisionViro={this._onCollision} onAnchorFoundViro={this._onAnchorFound} onAnchorUpdatedViro={this._onAnchorUpdated} onAnchorRemovedViro={this._onAnchorRemoved}/>);
    }
});
var VRTARImageMarker = react_native_1.requireNativeComponent('VRTARImageMarker', ViroARImageMarker, {
    nativeOnly: {
        position: [],
        scale: [],
        rotation: [],
        scalePivot: [],
        rotationPivot: [],
        animation: {},
        materials: [],
        physicsBody: {},
        transformBehaviors: [],
        hasTransformDelegate: true,
        canHover: true,
        canClick: true,
        canTouch: true,
        canScroll: true,
        canSwipe: true,
        canDrag: true,
        canPinch: true,
        canRotate: true,
        canFuse: true,
        onHoverViro: true,
        onClickViro: true,
        onTouchViro: true,
        onScrollViro: true,
        onSwipeViro: true,
        onDragViro: true,
        onPinchViro: true,
        onRotateViro: true,
        onFuseViro: true,
        timeToFuse: true,
        canCollide: true,
        onCollisionViro: true,
        onAnchorFoundViro: true,
        onAnchorUpdatedViro: true,
        onAnchorRemovedViro: true,
    }
});
module.exports = ViroARImageMarker;
