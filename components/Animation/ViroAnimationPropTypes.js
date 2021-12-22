/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroAnimationPropTypes
 * @flow
 */
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prop_types_1 = __importDefault(require("prop-types"));
var createStrictShapeTypeChecker = require("react-native/Libraries/DeprecatedPropTypes/deprecatedCreateStrictShapeTypeChecker");
var ColorPropType = require("react-native/Libraries/DeprecatedPropTypes/DeprecatedColorPropType");
var ViroAnimationPropTypes = {
    duration: prop_types_1.default.number.isRequired,
    delay: prop_types_1.default.number,
    easing: prop_types_1.default.string,
    properties: createStrictShapeTypeChecker({
        positionX: prop_types_1.default.oneOfType([prop_types_1.default.number, prop_types_1.default.string]),
        positionY: prop_types_1.default.oneOfType([prop_types_1.default.number, prop_types_1.default.string]),
        positionZ: prop_types_1.default.oneOfType([prop_types_1.default.number, prop_types_1.default.string]),
        scaleX: prop_types_1.default.oneOfType([prop_types_1.default.number, prop_types_1.default.string]),
        scaleY: prop_types_1.default.oneOfType([prop_types_1.default.number, prop_types_1.default.string]),
        scaleZ: prop_types_1.default.oneOfType([prop_types_1.default.number, prop_types_1.default.string]),
        rotateX: prop_types_1.default.oneOfType([prop_types_1.default.number, prop_types_1.default.string]),
        rotateY: prop_types_1.default.oneOfType([prop_types_1.default.number, prop_types_1.default.string]),
        rotateZ: prop_types_1.default.oneOfType([prop_types_1.default.number, prop_types_1.default.string]),
        translateX: prop_types_1.default.oneOfType([prop_types_1.default.number, prop_types_1.default.string]),
        translateY: prop_types_1.default.oneOfType([prop_types_1.default.number, prop_types_1.default.string]),
        translateZ: prop_types_1.default.oneOfType([prop_types_1.default.number, prop_types_1.default.string]),
        opacity: prop_types_1.default.oneOfType([prop_types_1.default.number, prop_types_1.default.string]),
        color: ColorPropType,
        material: prop_types_1.default.string,
    }).isRequired,
};
module.exports = ViroAnimationPropTypes;
