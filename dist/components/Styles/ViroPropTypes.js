/**
 * Copyright (c) 2016-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroPropTypes
 * @flow
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
/**
 * This file is derived from react-native's ViewStylePropTypes by removing
 * the props that we don't support.
 */
var ShadowPropTypesIOS = require('react-native/Libraries/DeprecatedPropTypes/DeprecatedShadowPropTypesIOS');
var LayoutPropTypes = require('react-native/Libraries/DeprecatedPropTypes/DeprecatedLayoutPropTypes');
/**
 * Warning: Some of these properties may not be supported in all releases.
 */
var ViroPropTypes = __assign(__assign({}, LayoutPropTypes), ShadowPropTypesIOS);
module.exports = ViroPropTypes;
