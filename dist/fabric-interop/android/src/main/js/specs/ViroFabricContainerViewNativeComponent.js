"use strict";
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Commands = void 0;
const codegenNativeComponent_1 = __importDefault(require("react-native/Libraries/Utilities/codegenNativeComponent"));
const codegenNativeCommands_1 = __importDefault(require("react-native/Libraries/Utilities/codegenNativeCommands"));
exports.Commands = (0, codegenNativeCommands_1.default)({
    supportedCommands: ["initialize", "cleanup"],
});
exports.default = (0, codegenNativeComponent_1.default)("ViroFabricContainerView");
