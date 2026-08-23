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
exports.ViroARScene = void 0;
exports.anchorToViro = anchorToViro;
/**
 * Web implementation of ViroARScene. Renders its children under the scene root
 * (provided by ViroARSceneNavigator.web) and bridges the AR session's plane
 * stream + tracking state to the declarative callbacks:
 *   - onTrackingUpdated       when the tracking state changes
 *   - onAnchorFound/Updated/Removed  as slam planes appear/move/disappear
 *
 * It also provides a claim registry so multiple auto-matching <ViroARPlane>s
 * don't bind to the same detected plane, and exposes performARHitTestWithPoint
 * via ref (ray-vs-plane in the session).
 *
 * MVP scope: plane anchors only (slam has no image/object anchors).
 */
const React = __importStar(require("react"));
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const ViroWebContext_1 = require("../Web/ViroWebContext");
const ViroConstants_1 = require("../ViroConstants");
function anchorToViro(p) {
    return {
        anchorId: p.id,
        type: "plane",
        position: p.center,
        rotation: p.rotation,
        scale: [1, 1, 1],
        center: [0, 0, 0], // anchor origin sits at the plane center
        width: p.width,
        height: p.height,
        alignment: p.alignment,
    };
}
function trackingStateToConstant(state) {
    switch (state) {
        case viro_web_renderer_1.ViroTrackingState.Normal:
            return ViroConstants_1.ViroTrackingStateConstants.TRACKING_NORMAL;
        case viro_web_renderer_1.ViroTrackingState.Limited:
            return ViroConstants_1.ViroTrackingStateConstants.TRACKING_LIMITED;
        default:
            return ViroConstants_1.ViroTrackingStateConstants.TRACKING_UNAVAILABLE;
    }
}
exports.ViroARScene = (0, react_1.forwardRef)(function ViroARScene(props, ref) {
    const { session, anchors, trackingState } = (0, ViroWebContext_1.useViroAR)();
    const renderer = (0, ViroWebContext_1.useViroRenderer)();
    // Read latest callbacks from a ref so effects don't re-run on identity change.
    const propsRef = (0, react_1.useRef)(props);
    propsRef.current = props;
    // Tracking state → onTrackingUpdated.
    (0, react_1.useEffect)(() => {
        propsRef.current.onTrackingUpdated?.(trackingStateToConstant(trackingState), ViroConstants_1.ViroARTrackingReasonConstants.TRACKING_REASON_NONE);
    }, [trackingState]);
    // Plane set diff → onAnchorFound / onAnchorUpdated / onAnchorRemoved.
    const knownRef = (0, react_1.useRef)(new Map());
    (0, react_1.useEffect)(() => {
        const known = knownRef.current;
        const next = new Map(anchors.map((a) => [a.id, a]));
        const p = propsRef.current;
        for (const a of anchors) {
            if (known.has(a.id))
                p.onAnchorUpdated?.(anchorToViro(a));
            else
                p.onAnchorFound?.(anchorToViro(a));
        }
        for (const [id, a] of known) {
            if (!next.has(id))
                p.onAnchorRemoved?.(anchorToViro(a));
        }
        knownRef.current = next;
    }, [anchors]);
    // Claim registry so auto-matching planes don't share an anchor.
    const claimsRef = (0, react_1.useRef)(new Map());
    const claims = (0, react_1.useRef)({
        claim(componentId, candidateIds) {
            const map = claimsRef.current;
            const current = map.get(componentId);
            if (current && candidateIds.includes(current))
                return current;
            const taken = new Set([...map.entries()].filter(([k]) => k !== componentId).map(([, v]) => v));
            const pick = candidateIds.find((id) => !taken.has(id));
            if (pick)
                map.set(componentId, pick);
            else
                map.delete(componentId);
            return pick ?? null;
        },
        release(componentId) {
            claimsRef.current.delete(componentId);
        },
        claimed(componentId) {
            return claimsRef.current.get(componentId) ?? null;
        },
    }).current;
    (0, react_1.useImperativeHandle)(ref, () => ({
        performARHitTestWithPoint: async (x, y) => {
            if (!session)
                return [];
            const { width, height } = renderer.canvasSize;
            return session.hitTest(x, y, width, height);
        },
    }), [session, renderer]);
    return (<ViroWebContext_1.ViroARPlaneClaimsContext.Provider value={claims}>
      {props.children}
    </ViroWebContext_1.ViroARPlaneClaimsContext.Provider>);
});
