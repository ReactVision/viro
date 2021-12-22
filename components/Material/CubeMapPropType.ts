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
"use strict";

import { ViroSource } from "../Types/ViroUtils";
import PropTypes from "prop-types";
import { ImageResolvedAssetSource } from "react-native";

// Reflective textures are cube maps(nx, px, ny, py, nz, pz), which is
// left(negative x), right(positive x), down(neg y), up(pos y), forward(neg z), backward(pos z)

export type ViroCubeMap = {
  nx: ViroSource;
  px: ViroSource;
  ny: ViroSource;
  py: ViroSource;
  nz: ViroSource;
  pz: ViroSource;
};

export type ViroResolvedCubeMap = {
  nx: ImageResolvedAssetSource;
  px: ImageResolvedAssetSource;
  ny: ImageResolvedAssetSource;
  py: ImageResolvedAssetSource;
  nz: ImageResolvedAssetSource;
  pz: ImageResolvedAssetSource;
};

export const CubeMapPropType = PropTypes.shape({
  // Opaque type returned by require('./image.jpg')
  nx: PropTypes.oneOfType([
    PropTypes.shape({
      uri: PropTypes.string,
    }),
    PropTypes.number,
  ]).isRequired,
  px: PropTypes.oneOfType([
    PropTypes.shape({
      uri: PropTypes.string,
    }),
    PropTypes.number,
  ]).isRequired,
  ny: PropTypes.oneOfType([
    PropTypes.shape({
      uri: PropTypes.string,
    }),
    PropTypes.number,
  ]).isRequired,
  py: PropTypes.oneOfType([
    PropTypes.shape({
      uri: PropTypes.string,
    }),
    PropTypes.number,
  ]).isRequired,
  nz: PropTypes.oneOfType([
    PropTypes.shape({
      uri: PropTypes.string,
    }),
    PropTypes.number,
  ]).isRequired,
  pz: PropTypes.oneOfType([
    PropTypes.shape({
      uri: PropTypes.string,
    }),
    PropTypes.number,
  ]).isRequired,
});
