"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSceneNavigator = void 0;
/**
 * ViroSceneNavigator.web.tsx
 *
 * Not implemented on web — this is the legacy Cardboard/GVR-era base scene
 * navigator; Viro3DSceneNavigator.web.tsx is the real web entry point for a
 * non-AR 3D scene (see that file for the actual WASM/WebGL2 wiring). This
 * stub exists only so the platform-extension resolver picks it over
 * ViroSceneNavigator.tsx on web, whose top-level requireNativeComponent()
 * call otherwise crashes the whole @reactvision/react-viro barrel import on
 * web the moment anything requires it.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
const React = __importStar(require("react"));
class ViroSceneNavigator extends React.Component {
    render() {
        if (__DEV__) {
            console.warn("[Viro web] ViroSceneNavigator is not supported on web; use Viro3DSceneNavigator instead.");
        }
        return null;
    }
}
exports.ViroSceneNavigator = ViroSceneNavigator;
