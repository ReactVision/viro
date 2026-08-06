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
exports.ViroOrbitCamera = ViroOrbitCamera;
/**
 * Web implementation of ViroOrbitCamera — a camera at `position` looking at
 * `focalPoint`. Reuses the node camera; the look-at is expressed as an Euler
 * rotation (no roll). When `active`, becomes the renderer's point of view.
 *
 * NOTE: the look-at Euler is MVP-approximate (yaw/pitch, no roll); validate the
 * sign convention on-device if precise framing matters.
 */
const React = __importStar(require("react"));
const react_1 = require("react");
const useViroNode_1 = require("./Web/useViroNode");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const RAD2DEG = 180 / Math.PI;
function lookAtEuler(position, focal) {
    const dx = focal[0] - position[0];
    const dy = focal[1] - position[1];
    const dz = focal[2] - position[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const nz = dz / len;
    const yaw = Math.atan2(nx, -nz) * RAD2DEG;
    const pitch = -Math.asin(Math.max(-1, Math.min(1, ny))) * RAD2DEG;
    return [pitch, yaw, 0];
}
function ViroOrbitCamera(props) {
    const position = (props.position ?? [0, 0, 0]);
    const rotation = props.focalPoint
        ? lookAtEuler(position, props.focalPoint)
        : props.rotation;
    const node = (0, useViroNode_1.useViroNode)({ ...props, rotation });
    const scene = (0, ViroWebContext_1.useViroScene)();
    const active = props.active !== false;
    (0, react_1.useEffect)(() => {
        scene.setNodeCamera(node);
    }, [scene, node]);
    (0, react_1.useEffect)(() => {
        if (active)
            scene.setActiveCameraNode(node);
    }, [scene, node, active]);
    return (<ViroWebContext_1.ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroWebContext_1.ViroParentNodeContext.Provider>);
}
