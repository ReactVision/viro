/**
 * Copyright (c) 2016-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule MaterialValidation
 * @flow
 */
'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var prop_types_1 = __importDefault(require("prop-types"));
var MaterialPropTypes = require('./MaterialPropTypes');
var invariant = require('fbjs/lib/invariant');
var MaterialValidation = /** @class */ (function () {
    function MaterialValidation() {
    }
    /*
     This method checks 1 prop at a time even though we could be checking
     all of them at a time so that we can surface a better error message
     */
    MaterialValidation.validateMaterialProp = function (prop, materialName, material, caller) {
        if (!__DEV__) {
            return;
        }
        if (allMaterialTypes[prop] === undefined) {
            var message1 = '"' + prop + '" of material "' + materialName + '" is not a valid material property.';
            var message2 = '\nValid material props: ' +
                JSON.stringify(Object.keys(allMaterialTypes).sort(), null, '  ');
            materialError(message1, material, caller, message2);
        }
        var errorCallback = function () {
            materialError('"' + prop + '" of material "' + materialName + '" is not valid.', material, caller);
        };
        var validationDict = {};
        validationDict[prop] = MaterialPropTypes[prop];
        var valueDict = {};
        valueDict[prop] = material[prop];
        prop_types_1.default.checkPropTypes(validationDict, valueDict, 'prop', caller, errorCallback);
    };
    MaterialValidation.validateMaterial = function (name, materials) {
        if (!__DEV__) {
            return;
        }
        for (var prop in materials[name]) {
            MaterialValidation.validateMaterialProp(prop, name, materials[name], 'MaterialValidation ' + name);
        }
        // If we don't want to "loop", then we can use the below commented out code to simply
        // check all the props at once!
        // var errorCallback = ()=>{
        //   materialError("Error validating Material: [" + name + "]", materials[name], 'MaterialValidation ' + name);
        // };
        // PropTypes.checkPropTypes(MaterialPropTypes, name, materials[name], 'prop', 'MaterialValidation ' + name, errorCallback);
    };
    MaterialValidation.addValidMaterialPropTypes = function (materialPropTypes) {
        for (var key in materialPropTypes) {
            allMaterialTypes[key] = materialPropTypes[key];
        }
    };
    return MaterialValidation;
}());
var materialError = function (message1, material, caller /*?*/, message2 /*?*/) {
    invariant(false, message1 + '\n' + (caller || '<<unknown>>') + ': ' +
        JSON.stringify(material, null, '  ') + (message2 || ''));
};
var allMaterialTypes = {};
MaterialValidation.addValidMaterialPropTypes(MaterialPropTypes);
module.exports = MaterialValidation;
