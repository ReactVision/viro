"use strict";
/**
 * ViroARPlane
 *
 * Container for Viro Components anchored to a detected plane.
 */
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
exports.ViroARPlane = ViroARPlane;
const React = __importStar(require("react"));
const react_1 = require("react");
const ViroNode_1 = require("../ViroNode");
const ViroUtils_1 = require("../ViroUtils");
const NativeViro_1 = require("../../NativeViro");
/**
 * Container for Viro Components anchored to a detected plane.
 */
function ViroARPlane(props) {
    const { anchorId, minHeight, minWidth, alignment, onAnchorFound, onAnchorUpdated, onAnchorRemoved, children, ...rest } = props;
    // Create the node
    const nodeProps = {
        ...rest,
        anchorId,
        minHeight,
        minWidth,
        alignment,
    };
    const nodeId = (0, ViroUtils_1.useViroNode)("arPlane", nodeProps);
    // Set up event listeners
    (0, react_1.useEffect)(() => {
        const anchorFoundCallbackId = onAnchorFound
            ? (0, NativeViro_1.registerEventListener)(nodeId, "onAnchorFound", (event) => {
                onAnchorFound(event.anchorFoundMap);
            })
            : null;
        const anchorUpdatedCallbackId = onAnchorUpdated
            ? (0, NativeViro_1.registerEventListener)(nodeId, "onAnchorUpdated", (event) => {
                onAnchorUpdated(event.anchorUpdatedMap);
            })
            : null;
        const anchorRemovedCallbackId = onAnchorRemoved
            ? (0, NativeViro_1.registerEventListener)(nodeId, "onAnchorRemoved", () => {
                onAnchorRemoved();
            })
            : null;
        // Clean up event listeners
        return () => {
            if (anchorFoundCallbackId) {
                (0, NativeViro_1.unregisterEventListener)(nodeId, "onAnchorFound", anchorFoundCallbackId);
            }
            if (anchorUpdatedCallbackId) {
                (0, NativeViro_1.unregisterEventListener)(nodeId, "onAnchorUpdated", anchorUpdatedCallbackId);
            }
            if (anchorRemovedCallbackId) {
                (0, NativeViro_1.unregisterEventListener)(nodeId, "onAnchorRemoved", anchorRemovedCallbackId);
            }
        };
    }, [nodeId, onAnchorFound, onAnchorUpdated, onAnchorRemoved]);
    // Render children within this node
    return (<ViroNode_1.ViroNode viroTag={nodeId} position={[0, 0, 0]}>
      {children}
    </ViroNode_1.ViroNode>);
}
//# sourceMappingURL=ViroARPlane.js.map