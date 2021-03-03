/**
 * Copyright (c) 2016-present, Viro Media, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViroTextStylePropTypes
 * @flow
 */
'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var prop_types_1 = __importDefault(require("prop-types"));
var ColorPropType = require('react-native/Libraries/DeprecatedPropTypes/DeprecatedColorPropType');
var ViroStylePropTypes = require('./ViroPropTypes');
var ViroTextStylePropTypes = Object.assign(Object.create(ViroStylePropTypes), {
    color: ColorPropType,
    fontFamily: prop_types_1.default.string,
    fontSize: prop_types_1.default.number,
    fontStyle: prop_types_1.default.oneOf(['normal', 'italic']),
    fontWeight: prop_types_1.default.oneOf(['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']),
    /**
     * Specifies text alignment.
     */
    textAlign: prop_types_1.default.oneOf(['left' /*default*/, 'right', 'center']),
    textAlignVertical: prop_types_1.default.oneOf(['top' /*default*/, 'bottom', 'center']),
    textClipMode: prop_types_1.default.oneOf(['none', 'clipToBounds']),
    textLineBreakMode: prop_types_1.default.oneOf(['wordwrap', 'charwrap', 'justify', 'none'])
});
module.exports = ViroTextStylePropTypes;
