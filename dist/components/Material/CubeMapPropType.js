/**
 * Copyright (c) 2016-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule CubeMapPropType
 * @flow
 */
'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var prop_types_1 = __importDefault(require("prop-types"));
// Reflective textures are cube maps(nx, px, ny, py, nz, pz), which is
// left(negative x), right(positive x), down(neg y), up(pos y), forward(neg z), backward(pos z)
var CubeMapPropType = prop_types_1.default.shape({
    // Opaque type returned by require('./image.jpg')
    nx: prop_types_1.default.oneOfType([
        prop_types_1.default.shape({
            uri: prop_types_1.default.string,
        }),
        prop_types_1.default.number,
    ]).isRequired,
    px: prop_types_1.default.oneOfType([
        prop_types_1.default.shape({
            uri: prop_types_1.default.string,
        }),
        prop_types_1.default.number,
    ]).isRequired,
    ny: prop_types_1.default.oneOfType([
        prop_types_1.default.shape({
            uri: prop_types_1.default.string,
        }),
        prop_types_1.default.number,
    ]).isRequired,
    py: prop_types_1.default.oneOfType([
        prop_types_1.default.shape({
            uri: prop_types_1.default.string,
        }),
        prop_types_1.default.number,
    ]).isRequired,
    nz: prop_types_1.default.oneOfType([
        prop_types_1.default.shape({
            uri: prop_types_1.default.string,
        }),
        prop_types_1.default.number,
    ]).isRequired,
    pz: prop_types_1.default.oneOfType([
        prop_types_1.default.shape({
            uri: prop_types_1.default.string,
        }),
        prop_types_1.default.number,
    ]).isRequired,
});
module.exports = CubeMapPropType;
