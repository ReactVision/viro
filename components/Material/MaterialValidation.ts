/**
 * Copyright (c) 2016-present, Viro, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @todo: used any in some places
 *
 * @providesModule MaterialValidation
 * @flow
 */
"use strict";

import PropTypes from "prop-types";
import { MaterialPropTypes } from "./MaterialPropTypes";

export type ViroMaterial = any;

export class MaterialValidation {
  /*
  This method checks 1 prop at a time even though we could be checking
  all of them at a time so that we can surface a better error message
   */
  static validateMaterialProp(
    prop: keyof typeof MaterialPropTypes,
    materialName: string,
    material: ViroMaterial,
    caller: any
  ) {
    if (!__DEV__) {
      return;
    }
    if (allMaterialTypes[prop] === undefined) {
      var message1 =
        '"' +
        prop +
        '" of material "' +
        materialName +
        '" is not a valid material property.';
      var message2 =
        "\nValid material props: " +
        JSON.stringify(Object.keys(allMaterialTypes).sort(), null, "  ");
      materialError(message1, material, caller, message2);
    }

    var errorCallback = () => {
      materialError(
        '"' + prop + '" of material "' + materialName + '" is not valid.',
        material,
        caller
      );
    };
    let validationDict: any = {};
    validationDict[prop] = MaterialPropTypes[prop];
    let valueDict: any = {};
    valueDict[prop] = material[prop];
    PropTypes.checkPropTypes(
      validationDict,
      valueDict,
      "prop",
      caller,
      errorCallback
    );
  }

  static validateMaterial(name: string, materials: any) {
    if (!__DEV__) {
      return;
    }
    for (var prop in materials[name]) {
      MaterialValidation.validateMaterialProp(
        prop as any,
        name,
        materials[name],
        "MaterialValidation " + name
      );
    }

    // If we don't want to "loop", then we can use the below commented out code to simply
    // check all the props at once!
    // var errorCallback = ()=>{
    //   materialError("Error validating Material: [" + name + "]", materials[name], 'MaterialValidation ' + name);
    // };
    // PropTypes.checkPropTypes(MaterialPropTypes, name, materials[name], 'prop', 'MaterialValidation ' + name, errorCallback);
  }

  static addValidMaterialPropTypes(materialPropTypes: any) {
    for (var key in materialPropTypes) {
      allMaterialTypes[key] = materialPropTypes[key];
    }
  }
}

var materialError = function (
  message1: string,
  material: ViroMaterial,
  caller?: any,
  message2?: string
) {
  const format =
    `${message1}\n` +
    `${caller || "<<unknown>>"}: ` +
    JSON.stringify(material, null, "  ") +
    (message2 || "");
  const error = new Error(format);
  error.name = "Invariant Violation";
  // @ts-ignore
  error.framesToPop = 1; // Skip invariant error's own stack frame.
  throw error;
};

var allMaterialTypes: any = {};

MaterialValidation.addValidMaterialPropTypes(MaterialPropTypes);
