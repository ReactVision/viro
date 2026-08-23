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
exports.ViroQuad = ViroQuad;
/**
 * Web implementation of ViroQuad — a node with a flat quad geometry (same
 * underlying surface as ViroSurface). Dimensions are read on mount.
 */
const React = __importStar(require("react"));
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
function ViroQuad(props) {
    const width = props.width ?? 1;
    const height = props.height ?? 1;
    const node = (0, useViroNode_1.useViroNode)(props, (scene) => scene.createSurface(width, height));
    return (<ViroWebContext_1.ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroWebContext_1.ViroParentNodeContext.Provider>);
}
