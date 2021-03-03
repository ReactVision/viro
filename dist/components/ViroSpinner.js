"use strict";
/**
 * Copyright (c) 2017-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroSpinner
 */
'user strict';
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
var react_1 = __importDefault(require("react"));
var prop_types_1 = __importDefault(require("prop-types"));
var ViroProps_1 = require("./Utilities/ViroProps");
var createReactClass = require('create-react-class');
var ViroMaterials = require('./Material/ViroMaterials');
var ViroAnimations = require('./Animation/ViroAnimations');
var ViroNode = require('./ViroNode');
var ViroImage = require('./ViroImage');
// Setup spinner assets
var ViroSpinner_1 = require('./Resources/viro_spinner_1.png');
var ViroSpinner_1a = require('./Resources/viro_spinner_1a.png');
var ViroSpinner_1_w = require('./Resources/viro_spinner_1_w.png');
var ViroSpinner_1a_w = require('./Resources/viro_spinner_1a_w.png');
/**
 * Composite control for a 2D Spinner
 */
var ViroSpinner = createReactClass({
    propTypes: {
        position: prop_types_1.default.arrayOf(prop_types_1.default.number),
        rotation: prop_types_1.default.arrayOf(prop_types_1.default.number),
        scalePivot: prop_types_1.default.arrayOf(prop_types_1.default.number),
        rotationPivot: prop_types_1.default.arrayOf(prop_types_1.default.number),
        scale: prop_types_1.default.arrayOf(prop_types_1.default.number),
        opacity: prop_types_1.default.number,
        materials: prop_types_1.default.oneOfType([
            prop_types_1.default.arrayOf(prop_types_1.default.string),
            prop_types_1.default.string
        ]),
        animation: prop_types_1.default.shape({
            interruptible: prop_types_1.default.bool,
            name: prop_types_1.default.string,
            delay: prop_types_1.default.number,
            loop: prop_types_1.default.bool,
            onStart: prop_types_1.default.func,
            onFinish: prop_types_1.default.func,
            run: prop_types_1.default.bool,
        }),
        transformBehaviors: prop_types_1.default.oneOfType([
            prop_types_1.default.arrayOf(prop_types_1.default.string),
            prop_types_1.default.string
        ]),
        onTransformUpdate: prop_types_1.default.func,
        renderingOrder: prop_types_1.default.number,
        visible: prop_types_1.default.bool,
        /**
         * Spinner visual type for either a light or dark theme.
         * This defaults to dark.
         */
        type: prop_types_1.default.oneOf(['Dark', 'Light']),
        ignoreEventHandling: prop_types_1.default.bool,
        dragType: prop_types_1.default.oneOf(["FixedDistance", "FixedDistanceOrigin", "FixedToWorld", "FixedToPlane"]),
        dragPlane: prop_types_1.default.shape({
            planePoint: prop_types_1.default.arrayOf(prop_types_1.default.number),
            planeNormal: prop_types_1.default.arrayOf(prop_types_1.default.number),
            maxDistance: prop_types_1.default.number
        }),
        onHover: prop_types_1.default.func,
        onClick: prop_types_1.default.func,
        onClickState: prop_types_1.default.func,
        onTouch: prop_types_1.default.func,
        onDrag: prop_types_1.default.func,
        onPinch: prop_types_1.default.func,
        onRotate: prop_types_1.default.func,
        onFuse: prop_types_1.default.oneOfType([
            prop_types_1.default.shape({
                callback: prop_types_1.default.func.isRequired,
                timeToFuse: prop_types_1.default.number
            }),
            prop_types_1.default.func
        ]),
        physicsBody: prop_types_1.default.shape({
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
        }),
        viroTag: prop_types_1.default.string,
        onCollision: prop_types_1.default.func,
    },
    getDefaultProps: function () {
        return {
            type: 'Dark'
        };
    },
    applyImpulse: function (force, position) {
        this._component.applyImpulse(force, position);
    },
    applyTorqueImpulse: function (torque) {
        this._component.applyTorqueImpulse(torque);
    },
    setVelocity: function (velocity) {
        this._component.setVelocity(findNodeHandle(this), velocity);
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
    render: function () {
        var _this = this;
        ViroProps_1.checkMisnamedProps("ViroSpinner", this.props);
        // Since transformBehaviors can be either a string or an array, convert the string to a 1-element array.
        var transformBehaviors = typeof this.props.transformBehaviors === 'string' ?
            new Array(this.props.transformBehaviors) : this.props.transformBehaviors;
        // TODO: rather than manually expanding/setting all the props, we should use {...this.props}
        return (<ViroNode position={this.props.position} rotation={this.props.rotation} scale={this.props.scale} rotationPivot={this.props.rotationPivot} scalePivot={this.props.scalePivot} physicsBody={this.props.physicsBody} opacity={this.props.opacity} transformBehaviors={transformBehaviors} visible={this.props.visible} renderingOrder={this.props.renderingOrder} onHover={this.props.onHover} onClick={this.props.onClick} onClickState={this.props.onClickState} onTouch={this.props.onTouch} onDrag={this.props.onDrag} onPinch={this.props.onPinch} onRotate={this.props.onRotate} onFuse={this.props.onFuse} animation={this.props.animation} onAnimationStartViro={this._onAnimationStart} onAnimationFinishViro={this._onAnimationFinish} dragType={this.props.dragType} ignoreEventHandling={this.props.ignoreEventHandling} onTransformUpdate={this.props.onTransformUpdate} ref={function (component) { _this._component = component; }}>

          <ViroImage source={this._getImage1()} materials={this.props.materials} animation={{ name: "_ViroSpinner_clockwiseZ", delay: 0, loop: true, run: true }}/>


        

        <ViroImage position={[0, 0, .01]} source={this._getImage1a()} materials={this.props.materials} animation={{ name: "_ViroSpinner_counterClockwiseZ", delay: 0, loop: true, run: true }}/>
      </ViroNode>);
    },
    _getImage1: function () {
        return this.props.type.toUpperCase() == 'Light'.toUpperCase() ? ViroSpinner_1 : ViroSpinner_1_w;
    },
    _getImage1a: function () {
        return this.props.type.toUpperCase() == 'Light'.toUpperCase() ? ViroSpinner_1a : ViroSpinner_1a_w;
    },
});
ViroAnimations.registerAnimations({
    _ViroSpinner_counterClockwiseZ: {
        properties: {
            rotateZ: "+=90"
        },
        duration: 250,
    },
    _ViroSpinner_clockwiseZ: {
        properties: {
            rotateZ: "-=90"
        },
        duration: 250,
    },
});
module.exports = ViroSpinner;
