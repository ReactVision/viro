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
exports.ViroARObjectMarker = void 0;
/**
 * ViroARObjectMarker.web.tsx
 *
 * Not implemented on web — 3D-object tracking has no counterpart in the
 * WASM/WebGL2 renderer yet. See ViroARImageMarker.web.tsx for why this stub
 * exists at all (the native file crashes the whole barrel import on web).
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
const React = __importStar(require("react"));
class ViroARObjectMarker extends React.Component {
    render() {
        if (__DEV__) {
            console.warn("[Viro web] ViroARObjectMarker is not supported on web; rendering nothing.");
        }
        return null;
    }
}
exports.ViroARObjectMarker = ViroARObjectMarker;
