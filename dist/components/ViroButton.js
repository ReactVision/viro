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
"user strict";
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
exports.ViroButton = exports.ViroButtonStateTypes = void 0;
const React = __importStar(require("react"));
const ViroAnimations_1 = require("./Animation/ViroAnimations");
const ViroProps_1 = require("./Utilities/ViroProps");
const ViroImage_1 = require("./ViroImage");
const ViroNode_1 = require("./ViroNode");
var ViroButtonStateTypes;
(function (ViroButtonStateTypes) {
    ViroButtonStateTypes["BTN_TYPE_HOVER"] = "hovering";
    ViroButtonStateTypes["BTN_TYPE_NORMAL"] = "normal";
    ViroButtonStateTypes["BTN_TYPE_CLICKED"] = "clicked";
})(ViroButtonStateTypes = exports.ViroButtonStateTypes || (exports.ViroButtonStateTypes = {}));
/**
 * Composite controle for 2D button
 */
class ViroButton extends React.Component {
    _component = null;
    state = {
        buttonType: ViroButtonStateTypes.BTN_TYPE_NORMAL,
    };
    applyImpulse = (force, atPosition) => {
        this._component?.applyImpulse(force, atPosition);
    };
    applyTorqueImpulse = (torque) => {
        this._component?.applyTorqueImpulse(torque);
    };
    setVelocity = (velocity) => {
        this._component?.setVelocity(velocity);
    };
    _onAnimationStart = () => {
        this.props.animation &&
            this.props.animation.onStart &&
            this.props.animation.onStart();
    };
    _onAnimationFinish = () => {
        this.props.animation &&
            this.props.animation.onFinish &&
            this.props.animation.onFinish();
    };
    getTransformAsync = async () => {
        return await this._component?.getTransformAsync();
    };
    getBoundingBoxAsync = async () => {
        return await this._component?.getBoundingBoxAsync();
    };
    render() {
        (0, ViroProps_1.checkMisnamedProps)("ViroButton", this.props);
        // We default to showing the button if it's undefined
        const { visible = true } = this.props;
        var normalSrcVisible;
        var hoverSrcVisible;
        var clickSrcVisible;
        var hoverSource = this.props.hoverSource || this.props.gazeSource;
        var clickSource = this.props.clickSource || this.props.tapSource;
        let buttonScale = this.props.scale || [1, 1, 1];
        console.log("BUTTON TYPE", this.state.buttonType);
        switch (this.state.buttonType) {
            case ViroButtonStateTypes.BTN_TYPE_HOVER:
                hoverSrcVisible = visible && true;
                clickSrcVisible = false;
                normalSrcVisible = false;
                break;
            case ViroButtonStateTypes.BTN_TYPE_CLICKED:
                // start scale for button animation
                buttonScale = [
                    0.9 * buttonScale[0],
                    0.9 * buttonScale[1],
                    0.9 * buttonScale[2],
                ];
                hoverSrcVisible = false;
                clickSrcVisible = visible && true;
                normalSrcVisible = false;
                break;
            default:
                normalSrcVisible = visible && true;
                hoverSrcVisible = false;
                clickSrcVisible = false;
        }
        // TODO: rather than manually expanding/setting props, we should do
        // {...this.props} which will save us time when adding new properties
        return (<ViroNode_1.ViroNode ref={(component) => {
                this._component = component;
            }} visible={visible} physicsBody={this.props.physicsBody} position={this.props.position} onTransformUpdate={this.props.onTransformUpdate} onClickState={this.props.onClickState} onTouch={this.props.onTouch} onScroll={this.props.onScroll} onSwipe={this.props.onSwipe} onHover={this._onButtonHover} onClick={this._onButtonClicked} onDrag={this.props.onDrag} onPinch={this.props.onPinch} onRotate={this.props.onRotate} onCollision={this.props.onCollision} viroTag={this.props.viroTag} onFuse={this.props.onFuse} animation={this.props.animation} onAnimationStartViro={this._onAnimationStart} onAnimationFinishViro={this._onAnimationFinish} ignoreEventHandling={this.props.ignoreEventHandling} dragType={this.props.dragType}>
        <ViroImage_1.ViroImage source={this.props.source} rotation={this.props.rotation} rotationPivot={this.props.rotationPivot} scale={buttonScale} scalePivot={this.props.scalePivot} opacity={this.props.opacity} transformBehaviors={this.props.transformBehaviors} visible={normalSrcVisible} renderingOrder={this.props.renderingOrder} height={this.props.height} width={this.props.width} materials={this.props.materials}/>

        <ViroImage_1.ViroImage source={hoverSource ? hoverSource : this.props.source} rotation={this.props.rotation} rotationPivot={this.props.rotationPivot} scale={buttonScale} scalePivot={this.props.scalePivot} opacity={this.props.opacity} transformBehaviors={this.props.transformBehaviors} visible={hoverSrcVisible} renderingOrder={this.props.renderingOrder} height={this.props.height} width={this.props.width} materials={this.props.materials}/>

        <ViroImage_1.ViroImage source={clickSource
                ? clickSource
                : hoverSource
                    ? hoverSource
                    : this.props.source} rotation={this.props.rotation} scale={buttonScale} opacity={this.props.opacity} transformBehaviors={this.props.transformBehaviors} visible={clickSrcVisible} renderingOrder={this.props.renderingOrder} height={this.props.height} width={this.props.width} materials={this.props.materials} animation={{
                name: "clickAnimation",
                run: clickSrcVisible,
                onFinish: this._onAnimationFinished,
            }}/>
      </ViroNode_1.ViroNode>);
    }
    _onButtonHover = (isHovering, position, source) => {
        if (isHovering) {
            this.setState({
                buttonType: ViroButtonStateTypes.BTN_TYPE_HOVER,
            });
            if (this.props.onHover) {
                // TODO: This was different than the other onHover callbacks
                this.props.onHover(isHovering, position, source);
            }
        }
        else {
            this.setState({
                buttonType: ViroButtonStateTypes.BTN_TYPE_NORMAL,
            });
        }
    };
    _onButtonClicked = (position, source) => {
        this.setState({
            buttonType: ViroButtonStateTypes.BTN_TYPE_CLICKED,
        });
        if (this.props.onClick) {
            this.props.onClick(position, source);
        }
    };
    _onAnimationFinished = () => {
        this.setState({
            buttonType: ViroButtonStateTypes.BTN_TYPE_HOVER,
        });
    };
}
exports.ViroButton = ViroButton;
ViroAnimations_1.ViroAnimations.registerAnimations({
    clickAnimation: {
        properties: {
            scaleX: "/=0.9",
            scaleY: "/=0.9",
            scaleZ: "/=0.9",
        },
        easing: "Bounce",
        duration: 500,
    },
});
