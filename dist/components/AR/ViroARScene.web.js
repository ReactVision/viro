"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroARScene = void 0;
exports.anchorToViro = anchorToViro;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const ViroWebContext_1 = require("../Web/ViroWebContext");
const ViroConstants_1 = require("../ViroConstants");
const useViroToneMapping_1 = require("../Web/useViroToneMapping");
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
    (0, useViroToneMapping_1.useViroToneMapping)(props.toneMappingEnabled);
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
    return ((0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroARPlaneClaimsContext.Provider, { value: claims, children: props.children }));
});
