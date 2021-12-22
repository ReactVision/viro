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
import PropTypes from "prop-types";
export declare const ViroAnimationPropTypes: {
    duration: PropTypes.Validator<number>;
    delay: PropTypes.Requireable<number>;
    easing: PropTypes.Requireable<string>;
    properties: any;
};
