"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroARPlane = ViroARPlane;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const ViroWebContext_1 = require("../Web/ViroWebContext");
const useViroNode_1 = require("../Web/useViroNode");
const ViroARScene_web_1 = require("./ViroARScene.web");
let nextPlaneId = 1;
function alignmentMatches(anchor, want) {
    if (!want || want === "Horizontal") {
        return anchor.alignment === "HorizontalUpward" || anchor.alignment === "HorizontalDownward";
    }
    return anchor.alignment === want;
}
function ViroARPlane(props) {
    const { anchors } = (0, ViroWebContext_1.useViroAR)();
    const claims = (0, react_1.useContext)(ViroWebContext_1.ViroARPlaneClaimsContext);
    const componentId = (0, react_1.useRef)(`plane-${nextPlaneId++}`).current;
    const [matchedId, setMatchedId] = (0, react_1.useState)(null);
    // Candidate anchors (alignment + min size), largest first.
    const candidateIds = (0, react_1.useMemo)(() => {
        const minW = props.minWidth ?? 0;
        const minH = props.minHeight ?? 0;
        return anchors
            .filter((a) => alignmentMatches(a, props.alignment) && a.width >= minW && a.height >= minH)
            .sort((a, b) => b.width * b.height - a.width * a.height)
            .map((a) => a.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [anchors, props.alignment, props.minWidth, props.minHeight]);
    // Resolve the match: explicit anchorId, else claim an auto candidate.
    (0, react_1.useEffect)(() => {
        if (props.anchorId) {
            setMatchedId(anchors.some((a) => a.id === props.anchorId) ? props.anchorId : null);
            return;
        }
        const picked = claims ? claims.claim(componentId, candidateIds) : (candidateIds[0] ?? null);
        setMatchedId(picked);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [candidateIds, props.anchorId, anchors]);
    // Release the claim on unmount.
    (0, react_1.useEffect)(() => {
        return () => claims?.release(componentId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const matched = matchedId ? anchors.find((a) => a.id === matchedId) ?? null : null;
    // Drive the node transform from the matched anchor; hide when unmatched.
    const nodeProps = {
        ...props,
        position: matched ? matched.center : [0, 0, 0],
        rotation: matched ? matched.rotation : [0, 0, 0],
        visible: matched ? props.visible ?? true : false,
    };
    const node = (0, useViroNode_1.useViroNode)(nodeProps);
    // onAnchorFound / onAnchorUpdated / onAnchorRemoved transitions.
    const propsRef = (0, react_1.useRef)(props);
    propsRef.current = props;
    const prevMatchRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        const prev = prevMatchRef.current;
        const p = propsRef.current;
        if (matched) {
            if (prev !== matched.id)
                p.onAnchorFound?.((0, ViroARScene_web_1.anchorToViro)(matched));
            else
                p.onAnchorUpdated?.((0, ViroARScene_web_1.anchorToViro)(matched));
        }
        else if (prev) {
            p.onAnchorRemoved?.();
        }
        prevMatchRef.current = matched ? matched.id : null;
    }, [matched]);
    return (0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroParentNodeContext.Provider, { value: node, children: props.children });
}
