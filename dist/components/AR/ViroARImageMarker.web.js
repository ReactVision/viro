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
exports.ViroARImageMarker = void 0;
/**
 * ViroARImageMarker.web.tsx
 *
 * Not implemented on web — image-marker tracking has no counterpart in the
 * WASM/WebGL2 renderer yet. This file exists purely so the platform-extension
 * resolver picks THIS instead of ViroARImageMarker.tsx on web: the native file
 * calls requireNativeComponent() at module scope with no web guard, which
 * crashes the entire @reactvision/react-viro barrel import on web the moment
 * anything requires it — not just when this component is actually used.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
const React = __importStar(require("react"));
class ViroARImageMarker extends React.Component {
    render() {
        if (__DEV__) {
            console.warn("[Viro web] ViroARImageMarker is not supported on web; rendering nothing.");
        }
        return null;
    }
}
exports.ViroARImageMarker = ViroARImageMarker;
