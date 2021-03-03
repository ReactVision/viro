/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule MaterialPropTypes
 * @flow
 */
'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var prop_types_1 = __importDefault(require("prop-types"));
var CubeMapPropType = require('./CubeMapPropType');
var ColorPropType = require('react-native/Libraries/DeprecatedPropTypes/DeprecatedColorPropType');
var MaterialPropTypes = {
    shininess: prop_types_1.default.number,
    fresnelExponent: prop_types_1.default.number,
    lightingModel: prop_types_1.default.oneOf(['Phong', 'Blinn', 'Lambert', 'Constant', 'PBR']),
    writesToDepthBuffer: prop_types_1.default.bool,
    readsFromDepthBuffer: prop_types_1.default.bool,
    colorWriteMask: prop_types_1.default.arrayOf(prop_types_1.default.oneOf(['None', 'Red', 'Green', 'Blue', 'Alpha', 'All'])),
    cullMode: prop_types_1.default.oneOf(['None', 'Back', 'Front']),
    blendMode: prop_types_1.default.oneOf(['None', 'Alpha', 'Add', 'Subtract', 'Multiply', 'Screen']),
    diffuseTexture: prop_types_1.default.any,
    diffuseIntensity: prop_types_1.default.number,
    specularTexture: prop_types_1.default.any,
    normalTexture: prop_types_1.default.any,
    reflectiveTexture: CubeMapPropType,
    diffuseColor: ColorPropType,
    chromaKeyFilteringColor: ColorPropType,
    wrapS: prop_types_1.default.oneOf(['Clamp', 'Repeat', 'Mirror']),
    wrapT: prop_types_1.default.oneOf(['Clamp', 'Repeat', 'Mirror']),
    minificationFilter: prop_types_1.default.oneOf(['Nearest', 'Linear']),
    magnificationFilter: prop_types_1.default.oneOf(['Nearest', 'Linear']),
    mipFilter: prop_types_1.default.oneOf(['Nearest', 'Linear']),
    bloomThreshold: prop_types_1.default.number,
    roughness: prop_types_1.default.number,
    roughnessTexture: prop_types_1.default.any,
    metalness: prop_types_1.default.number,
    metalnessTexture: prop_types_1.default.any,
    ambientOcclusionTexture: prop_types_1.default.any,
};
module.exports = MaterialPropTypes;
