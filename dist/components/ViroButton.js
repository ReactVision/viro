"use strict";
/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroButton
 */
'user strict';
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
var ViroProps_1 = require("./Utilities/ViroProps");
var ViroPropTypes = require('./Styles/ViroPropTypes');
var createReactClass = require('create-react-class');
var StyleSheetPropType = require('react-native/Libraries/DeprecatedPropTypes/DeprecatedStyleSheetPropType');
var stylePropType = StyleSheetPropType(ViroPropTypes);
var ViroNode = require('./ViroNode');
var ViroImage = require('./ViroImage');
var ViroAnimations = require('./Animation/ViroAnimations');
var BTN_TYPE_HOVER = 'hovering';
var BTN_TYPE_NORMAL = 'normal';
var BTN_TYPE_CLICKED = 'clicked';
/**
 * Composite controle for 2D button
 */
var ViroButton = createReactClass({
    propTypes: __assign(__assign({}, react_native_1.View.propTypes), { 
        /**
         * The button image file, which is required
         */
        source: prop_types_1.default.oneOfType([
            prop_types_1.default.shape({
                uri: prop_types_1.default.string,
            }),
            // Opaque type returned by require('./image.jpg')
            prop_types_1.default.number,
        ]).isRequired, 
        /**
         * The image file, to be displayed when the user is hovering over it
         */
        hoverSource: prop_types_1.default.oneOfType([
            prop_types_1.default.shape({
                uri: prop_types_1.default.string,
            }),
            // Opaque type returned by require('./image.jpg')
            prop_types_1.default.number,
        ]), 
        /**
         * The image file, to be displayed when the user clicks the button
         */
        clickSource: prop_types_1.default.oneOfType([
            prop_types_1.default.shape({
                uri: prop_types_1.default.string,
            }),
            // Opaque type returned by require('./image.jpg')
            prop_types_1.default.number,
        ]), 
        /**
         * ##### DEPRECATION WARNING - this prop may be removed in future releases #####
         * The image file, to be displayed when the user taps the button
         */
        tapSource: prop_types_1.default.oneOfType([
            prop_types_1.default.shape({
                uri: prop_types_1.default.string,
            }),
            // Opaque type returned by require('./image.jpg')
            prop_types_1.default.number,
        ]), 
        /**
         * ##### DEPRECATION WARNING - this prop may be removed in future releases #####
         * The image file, to be displayed when the user is gazing over it
         */
        gazeSource: prop_types_1.default.oneOfType([
            prop_types_1.default.shape({
                uri: prop_types_1.default.string,
            }),
            // Opaque type returned by require('./image.jpg')
            prop_types_1.default.number,
        ]), position: prop_types_1.default.arrayOf(prop_types_1.default.number), scale: prop_types_1.default.arrayOf(prop_types_1.default.number), rotation: prop_types_1.default.arrayOf(prop_types_1.default.number), scalePivot: prop_types_1.default.arrayOf(prop_types_1.default.number), rotationPivot: prop_types_1.default.arrayOf(prop_types_1.default.number), materials: prop_types_1.default.oneOfType([
            prop_types_1.default.arrayOf(prop_types_1.default.string),
            prop_types_1.default.string
        ]), animation: prop_types_1.default.shape({
            name: prop_types_1.default.string,
            delay: prop_types_1.default.number,
            loop: prop_types_1.default.bool,
            onStart: prop_types_1.default.func,
            onFinish: prop_types_1.default.func,
            run: prop_types_1.default.bool,
            interruptible: prop_types_1.default.bool,
        }), transformBehaviors: prop_types_1.default.oneOfType([
            prop_types_1.default.arrayOf(prop_types_1.default.string),
            prop_types_1.default.string
        ]), onTransformUpdate: prop_types_1.default.func, renderingOrder: prop_types_1.default.number, visible: prop_types_1.default.bool, opacity: prop_types_1.default.number, height: prop_types_1.default.number, width: prop_types_1.default.number, style: stylePropType, dragType: prop_types_1.default.oneOf(["FixedDistance", "FixedDistanceOrigin", "FixedToWorld", "FixedToPlane"]), dragPlane: prop_types_1.default.shape({
            planePoint: prop_types_1.default.arrayOf(prop_types_1.default.number),
            planeNormal: prop_types_1.default.arrayOf(prop_types_1.default.number),
            maxDistance: prop_types_1.default.number
        }), ignoreEventHandling: prop_types_1.default.bool, onHover: prop_types_1.default.func, onClick: prop_types_1.default.func, onClickState: prop_types_1.default.func, onTouch: prop_types_1.default.func, onScroll: prop_types_1.default.func, onSwipe: prop_types_1.default.func, onDrag: prop_types_1.default.func, onPinch: prop_types_1.default.func, onRotate: prop_types_1.default.func, onFuse: prop_types_1.default.oneOfType([
            prop_types_1.default.shape({
                callback: prop_types_1.default.func.isRequired,
                timeToFuse: prop_types_1.default.number
            }),
            prop_types_1.default.func
        ]), physicsBody: prop_types_1.default.shape({
            type: prop_types_1.default.oneOf(['Dynamic', 'Kinematic', 'Static']).isRequired,
            mass: prop_types_1.default.number,
            restitution: prop_types_1.default.number,
            shape: prop_types_1.default.shape({
                type: prop_types_1.default.oneOf(["Box", "Sphere", "Compound"]).isRequired,
                params: prop_types_1.default.arrayOf(prop_types_1.default.number)
            }).isRequired,
            friction: prop_types_1.default.number,
            useGravity: prop_types_1.default.bool,
            enabled: prop_types_1.default.bool,
            velocity: prop_types_1.default.arrayOf(prop_types_1.default.number),
            force: prop_types_1.default.oneOfType([
                prop_types_1.default.arrayOf(prop_types_1.default.shape({
                    value: prop_types_1.default.arrayOf(prop_types_1.default.number),
                    position: prop_types_1.default.arrayOf(prop_types_1.default.number)
                })),
                prop_types_1.default.shape({
                    value: prop_types_1.default.arrayOf(prop_types_1.default.number),
                    position: prop_types_1.default.arrayOf(prop_types_1.default.number)
                }),
            ]),
            torque: prop_types_1.default.arrayOf(prop_types_1.default.number)
        }), viroTag: prop_types_1.default.string, onCollision: prop_types_1.default.func }),
    applyImpulse: function (force, atPosition) {
        this._component.applyImpulse(force, atPosition);
    },
    applyTorqueImpulse: function (torque) {
        this._component.applyTorqueImpulse(torque);
    },
    setVelocity: function (velocity) {
        this._component.setVelocity(velocity);
    },
    _onAnimationStart: function (event /*: Event*/) {
        this.props.animation && this.props.animation.onStart && this.props.animation.onStart();
    },
    _onAnimationFinish: function (event /*: Event*/) {
        this.props.animation && this.props.animation.onFinish && this.props.animation.onFinish();
    },
    getTransformAsync: function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._component.getTransformAsync()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    },
    getBoundingBoxAsync: function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._component.getBoundingBoxAsync()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    },
    getInitialState: function () {
        return { buttonType: BTN_TYPE_NORMAL };
    },
    render: function () {
        var _this = this;
        ViroProps_1.checkMisnamedProps("ViroButton", this.props);
        // We default to showing the button if it's undefined
        if (this.props.visible === undefined) {
            this.props.visible = true;
        }
        var normalSrcVisible;
        var hoverSrcVisible;
        var clickSrcVisible;
        var hoverSource = this.props.hoverSource || this.props.gazeSource;
        var clickSource = this.props.clickSource || this.props.tapSource;
        var buttonScale = this.props.scale || [1, 1, 1];
        switch (this.state.buttonType) {
            case BTN_TYPE_HOVER:
                hoverSrcVisible = this.props.visible && true;
                clickSrcVisible = false;
                normalSrcVisible = false;
                break;
            case BTN_TYPE_CLICKED:
                // start scale for button animation
                buttonScale = [0.9 * buttonScale[0],
                    0.9 * buttonScale[1],
                    0.9 * buttonScale[2]];
                hoverSrcVisible = false;
                clickSrcVisible = this.props.visible && true;
                normalSrcVisible = false;
                break;
            default:
                normalSrcVisible = this.props.visible && true;
                hoverSrcVisible = false;
                clickSrcVisible = false;
        }
        // TODO: rather than manually expanding/setting props, we should do
        // {...this.props} which will save us time when adding new properties
        return (<ViroNode ref={function (component) { _this._component = component; }} physicsBody={this.props.physicsBody} position={this.props.position} onTransformUpdate={this.props.onTransformUpdate} onClickState={this.props.onClickState} onTouch={this.props.onTouch} onScroll={this.props.onScroll} onSwipe={this.props.onSwipe} onHover={this._onButtonHover} onClick={this._onButtonClicked} onDrag={this.props.onDrag} onPinch={this.props.onPinch} onRotate={this.props.onRotate} onCollision={this.props.onCollision} viroTag={this.props.viroTag} onFuse={this.props.onFuse} animation={this.props.animation} onAnimationStartViro={this._onAnimationStart} onAnimationFinishViro={this._onAnimationFinish} ignoreEventHandling={this.props.ignoreEventHandling} dragType={this.props.dragType}>

            <ViroImage source={this.props.source} rotation={this.props.rotation} rotationPivot={this.props.rotationPivot} scale={buttonScale} scalePivot={this.props.scalePivot} opacity={this.props.opacity} transformBehaviors={this.props.transformBehaviors} visible={normalSrcVisible} renderingOrder={this.props.renderingOrder} height={this.props.height} width={this.props.width} materials={this.props.materials}/>

            <ViroImage source={hoverSource ? hoverSource : this.props.source} rotation={this.props.rotation} rotationPivot={this.props.rotationPivot} scale={buttonScale} scalePivot={this.props.scalePivot} opacity={this.props.opacity} transformBehaviors={this.props.transformBehaviors} visible={hoverSrcVisible} renderingOrder={this.props.renderingOrder} height={this.props.height} width={this.props.width} materials={this.props.materials}/>

            <ViroImage source={clickSource ? clickSource :
            (hoverSource ? hoverSource : this.props.source)} rotation={this.props.rotation} scale={buttonScale} opacity={this.props.opacity} transformBehaviors={this.props.transformBehaviors} visible={clickSrcVisible} renderingOrder={this.props.renderingOrder} height={this.props.height} width={this.props.width} materials={this.props.materials} animation={{
            animation: "clickAnimation",
            run: clickSrcVisible,
            onFinish: this._onAnimationFinished
        }}/>

    	</ViroNode>);
    },
    _onButtonHover: function (isHovering, source) {
        if (isHovering) {
            this.setState({
                buttonType: BTN_TYPE_HOVER
            });
            if (this.props.onHover) {
                this.props.onHover(isHovering, source);
            }
        }
        else {
            this.setState({
                buttonType: BTN_TYPE_NORMAL
            });
        }
    },
    _onButtonClicked: function (source) {
        this.setState({
            buttonType: BTN_TYPE_CLICKED
        });
        if (this.props.onClick) {
            this.props.onClick(source);
        }
    },
    _onAnimationFinished: function () {
        this.setState({
            buttonType: BTN_TYPE_HOVER
        });
    }
});
ViroAnimations.registerAnimations({
    clickAnimation: {
        properties: {
            scaleX: "/=0.9",
            scaleY: "/=0.9",
            scaleZ: "/=0.9"
        },
        easing: "Bounce",
        duration: 500,
    },
});
module.exports = ViroButton;
