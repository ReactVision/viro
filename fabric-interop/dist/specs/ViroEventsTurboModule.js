"use strict";
/**
 * ViroEventsTurboModule.ts
 * TurboModule specification for Viro event emission
 *
 * This module provides proper event emission for JSI callbacks
 * in React Native's New Architecture (Fabric + TurboModules)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
exports.default = react_native_1.TurboModuleRegistry.getEnforcing("ViroEvents");
//# sourceMappingURL=ViroEventsTurboModule.js.map