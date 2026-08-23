"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useViroNode = useViroNode;
/**
 * Shared lifecycle hook for web node components. Creates a native node (and
 * optional geometry) via the C API, parents it under the enclosing node, applies
 * transform/material props, and tears down on unmount.
 *
 * The node handle is created in a lazy useState initializer so it exists on the
 * first render — children read it from context and parent themselves correctly
 * even though React runs child effects before parent effects.
 */
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const ViroWebContext_1 = require("./ViroWebContext");
const viroMaterialRegistry_1 = require("./viroMaterialRegistry");
const useViroAnimation_1 = require("./useViroAnimation");
const DEG2RAD = Math.PI / 180;
function useViroNode(props, createGeometry, 
// Gates model animations, which only become available after a model loads.
// Declarative animations don't need it (default true).
animationReady = true, 
// When provided, the geometry is rebuilt whenever this key changes (e.g. text
// re-shapes). Omit for static geometry (box/sphere/surface) — built once.
geometryKey, 
// Factory for the underlying node (default `createNode`). Override for special
// node types, e.g. portal scenes (`createPortalScene`).
createNodeFn) {
    const scene = (0, ViroWebContext_1.useViroScene)();
    const renderer = (0, ViroWebContext_1.useViroRenderer)();
    const parent = (0, ViroWebContext_1.useViroParentNode)();
    const [node] = (0, react_1.useState)(() => createNodeFn ? createNodeFn(scene) : scene.createNode());
    const geometryRef = (0, react_1.useRef)(0);
    // Node lifecycle: attach to parent on mount; destroy node on unmount.
    (0, react_1.useEffect)(() => {
        scene.addChildNode(parent, node);
        return () => {
            scene.removeNodeFromParent(node);
            scene.destroyNode(node);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Geometry lifecycle: (re)built on mount and whenever geometryKey changes.
    (0, react_1.useEffect)(() => {
        if (!createGeometry)
            return;
        const geo = createGeometry(scene);
        geometryRef.current = geo;
        scene.setNodeGeometry(node, geo);
        return () => {
            if (geometryRef.current === geo)
                geometryRef.current = 0;
            scene.destroyGeometry(geo);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [geometryKey]);
    // Transform + visibility props.
    const [px, py, pz] = props.position ?? [0, 0, 0];
    const [rx, ry, rz] = props.rotation ?? [0, 0, 0];
    const [sx, sy, sz] = props.scale ?? [1, 1, 1];
    const opacity = props.opacity ?? 1;
    const visible = props.visible ?? true;
    (0, react_1.useEffect)(() => {
        scene.setNodePosition(node, px, py, pz);
        scene.setNodeRotation(node, rx * DEG2RAD, ry * DEG2RAD, rz * DEG2RAD);
        scene.setNodeScale(node, sx, sy, sz);
        scene.setNodeOpacity(node, opacity);
        scene.setNodeVisible(node, visible);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node, px, py, pz, rx, ry, rz, sx, sy, sz, opacity, visible]);
    // Events: register handlers once (reading latest props from a ref so changing
    // callback identities don't re-subscribe), and enable the needed event types.
    const propsRef = (0, react_1.useRef)(props);
    propsRef.current = props;
    const hasClick = !!(props.onClick || props.onClickState);
    const hasHover = !!props.onHover;
    (0, react_1.useEffect)(() => {
        if (!hasClick && !hasHover)
            return;
        renderer.setNodeEventHandlers(node, {
            onClick: (clickState, source, position) => {
                const p = propsRef.current;
                p.onClickState?.(clickState, position, source);
                if (clickState === viro_web_renderer_1.ViroClickState.Clicked) {
                    p.onClick?.(position, source);
                }
            },
            onHover: (isHovering, source, position) => {
                propsRef.current.onHover?.(isHovering, position, source);
            },
        });
        if (hasClick)
            scene.setNodeEventEnabled(node, viro_web_renderer_1.ViroEventAction.Click, true);
        if (hasHover)
            scene.setNodeEventEnabled(node, viro_web_renderer_1.ViroEventAction.Hover, true);
        return () => renderer.clearNodeEventHandlers(node);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node, hasClick, hasHover]);
    // Materials (first material applied to the geometry; MVP scope).
    const materialsKey = Array.isArray(props.materials)
        ? props.materials.join(",")
        : props.materials ?? "";
    (0, react_1.useEffect)(() => {
        const geo = geometryRef.current;
        if (!geo || !materialsKey)
            return;
        const firstName = materialsKey.split(",")[0];
        const material = (0, viroMaterialRegistry_1.createMaterialFromRegistry)(scene, firstName);
        if (material) {
            scene.setGeometryMaterial(geo, material);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node, materialsKey]);
    // Animation (declarative ViroAnimation or model animation).
    (0, useViroAnimation_1.useViroAnimation)(node, props.animation, { position: [px, py, pz], rotation: [rx, ry, rz], scale: [sx, sy, sz], opacity }, animationReady);
    return node;
}
