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
exports.ViroPortal = ViroPortal;
/**
 * Web implementation of ViroPortal — the entrance frame (VROPortalFrame) of the
 * enclosing ViroPortalScene. Its children are the doorway geometry (e.g. a
 * Viro3DObject of an arch/door). Registering the entrance parents the frame
 * under the portal scene, so this does not use useViroNode's auto-parenting.
 */
const React = __importStar(require("react"));
const react_1 = require("react");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const DEG2RAD = Math.PI / 180;
function ViroPortal(props) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    const portalScene = (0, ViroWebContext_1.useViroParentNode)(); // the enclosing VROPortal
    const [frame] = (0, react_1.useState)(() => scene.createPortalFrame());
    // Register as the portal scene's entrance (this also parents the frame).
    (0, react_1.useEffect)(() => {
        scene.setPortalEntrance(portalScene, frame);
        return () => scene.destroyNode(frame);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [px, py, pz] = props.position ?? [0, 0, 0];
    const [rx, ry, rz] = props.rotation ?? [0, 0, 0];
    const [sx, sy, sz] = props.scale ?? [1, 1, 1];
    (0, react_1.useEffect)(() => {
        scene.setNodePosition(frame, px, py, pz);
        scene.setNodeRotation(frame, rx * DEG2RAD, ry * DEG2RAD, rz * DEG2RAD);
        scene.setNodeScale(frame, sx, sy, sz);
    }, [scene, frame, px, py, pz, rx, ry, rz, sx, sy, sz]);
    return (<ViroWebContext_1.ViroParentNodeContext.Provider value={frame}>
      {props.children}
    </ViroWebContext_1.ViroParentNodeContext.Provider>);
}
