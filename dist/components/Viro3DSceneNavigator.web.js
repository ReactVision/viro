"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Viro3DSceneNavigator = Viro3DSceneNavigator;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroMaterialRegistry_1 = require("./Web/viroMaterialRegistry");
const useViroRendererEffects_1 = require("./Web/useViroRendererEffects");
const containerStyle = {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
};
const canvasStyle = {
    display: "block",
    width: "100%",
    height: "100%",
    touchAction: "none",
};
function Viro3DSceneNavigator(props) {
    const canvasRef = (0, react_1.useRef)(null);
    const [renderer, setRenderer] = (0, react_1.useState)(null);
    (0, useViroRendererEffects_1.useViroRendererEffects)(renderer, props);
    const [rootNode, setRootNode] = (0, react_1.useState)(0);
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        let created = null;
        (async () => {
            if (!canvasRef.current)
                return;
            try {
                created = await viro_web_renderer_1.ViroWebRenderer.create({
                    canvas: canvasRef.current,
                    ...props.webRendererOptions,
                });
                if (cancelled) {
                    created.dispose();
                    return;
                }
                setRootNode(created.scene.getRootNode());
                setRenderer(created);
            }
            catch (err) {
                console.error("[Viro web] failed to initialize renderer:", err);
            }
        })();
        return () => {
            cancelled = true;
            created?.dispose();
            (0, viroMaterialRegistry_1.resetMaterialCache)();
        };
    }, []);
    // Keep the renderer's viewport in sync with the canvas size (fixes aspect
    // distortion on layout/window resize). ResizeObserver catches container
    // changes, not just window resizes.
    (0, react_1.useEffect)(() => {
        const canvas = canvasRef.current;
        if (!renderer || !canvas)
            return;
        const observer = new ResizeObserver(() => renderer.resize());
        observer.observe(canvas);
        renderer.resize(); // correct the initial size once mounted/laid out
        return () => observer.disconnect();
    }, [renderer]);
    // Minimal sceneNavigator surface so scenes can mount (navigation is a follow-up).
    const sceneNavigator = {
        push: () => { },
        pop: () => { },
        popN: () => { },
        jump: () => { },
        replace: () => { },
        viroAppProps: props.viroAppProps ?? {},
    };
    const SceneComponent = props.initialScene?.scene;
    return ((0, jsx_runtime_1.jsxs)("div", { style: containerStyle, children: [(0, jsx_runtime_1.jsx)("canvas", { ref: canvasRef, style: canvasStyle }), renderer && rootNode && SceneComponent ? ((0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroRendererContext.Provider, { value: renderer, children: (0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroParentNodeContext.Provider, { value: rootNode, children: (0, jsx_runtime_1.jsx)(SceneComponent, { sceneNavigator: sceneNavigator, ...props.viroAppProps }) }) })) : null] }));
}
