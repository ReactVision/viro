"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroSceneNavigator = ViroSceneNavigator;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const ViroWebContext_1 = require("./Web/ViroWebContext");
const viroMaterialRegistry_1 = require("./Web/viroMaterialRegistry");
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
let tagCounter = 0;
function randomTag() {
    tagCounter += 1;
    return `viro-scene-${tagCounter}-${Math.floor(Math.random() * 1e9)}`;
}
/** Normalise the native push/replace/jump (key?, scene?) overloads. */
function resolveArgs(param1, param2) {
    let key;
    let descriptor;
    if (typeof param1 === "string") {
        key = param1;
        descriptor = param2;
    }
    else {
        descriptor = param1;
    }
    if (!key || key.trim().length === 0)
        key = randomTag();
    return { key, descriptor };
}
function ViroSceneNavigator(props) {
    const canvasRef = (0, react_1.useRef)(null);
    const [renderer, setRenderer] = (0, react_1.useState)(null);
    const [rootNode, setRootNode] = (0, react_1.useState)(0);
    const [stack, setStack] = (0, react_1.useState)(() => {
        const key = props.initialSceneKey ?? randomTag();
        return { dict: { [key]: props.initialScene }, history: [key] };
    });
    // Renderer bootstrap — identical to Viro3DSceneNavigator.web.
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
    (0, react_1.useEffect)(() => {
        const canvas = canvasRef.current;
        if (!renderer || !canvas)
            return;
        const observer = new ResizeObserver(() => renderer.resize());
        observer.observe(canvas);
        renderer.resize();
        return () => observer.disconnect();
    }, [renderer]);
    // Scene-stack operations. Each mutates the keyed dictionary + history; the
    // rendered scene is always the last key in history.
    const sceneNavigatorRef = (0, react_1.useRef)({
        push: (p1, p2) => {
            setStack((prev) => {
                const { key, descriptor } = resolveArgs(p1, p2);
                const dict = { ...prev.dict };
                if (descriptor)
                    dict[key] = descriptor;
                if (!dict[key]) {
                    console.warn(`[Viro web] push: no scene registered for key "${key}"`);
                    return prev;
                }
                return { dict, history: [...prev.history, key] };
            });
        },
        replace: (p1, p2) => {
            setStack((prev) => {
                const { key, descriptor } = resolveArgs(p1, p2);
                const dict = { ...prev.dict };
                if (descriptor)
                    dict[key] = descriptor;
                if (!dict[key]) {
                    console.warn(`[Viro web] replace: no scene registered for key "${key}"`);
                    return prev;
                }
                const history = prev.history.slice(0, -1);
                return { dict, history: [...history, key] };
            });
        },
        pop: () => sceneNavigatorRef.current.popN(1),
        popN: (n) => {
            setStack((prev) => {
                if (n <= 0)
                    return prev;
                if (prev.history.length - n <= 0) {
                    console.warn("[Viro web] Attempted to pop the root scene in ViroSceneNavigator!");
                    return prev;
                }
                return { dict: prev.dict, history: prev.history.slice(0, prev.history.length - n) };
            });
        },
        jump: (p1, p2) => {
            setStack((prev) => {
                const { key, descriptor } = resolveArgs(p1, p2);
                const dict = { ...prev.dict };
                if (descriptor)
                    dict[key] = descriptor;
                if (!dict[key]) {
                    console.warn(`[Viro web] jump: no scene registered for key "${key}"`);
                    return prev;
                }
                const history = prev.history.filter((k) => k !== key);
                return { dict, history: [...history, key] };
            });
        },
        recenterTracking: () => { }, // no VR recenter on web
        project: async (point) => renderer?.project?.(point) ?? point,
        unproject: async (point) => renderer?.unproject?.(point) ?? point,
        viroAppProps: props.viroAppProps ?? {},
    });
    sceneNavigatorRef.current.viroAppProps = props.viroAppProps ?? {};
    const topKey = stack.history[stack.history.length - 1];
    const descriptor = stack.dict[topKey];
    const SceneComponent = descriptor?.scene;
    return ((0, jsx_runtime_1.jsxs)("div", { style: containerStyle, children: [(0, jsx_runtime_1.jsx)("canvas", { ref: canvasRef, style: canvasStyle }), renderer && rootNode && SceneComponent ? ((0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroRendererContext.Provider, { value: renderer, children: (0, jsx_runtime_1.jsx)(ViroWebContext_1.ViroParentNodeContext.Provider, { value: rootNode, children: (0, jsx_runtime_1.jsx)(SceneComponent, { sceneNavigator: sceneNavigatorRef.current, ...(descriptor?.passProps ?? {}), ...(props.viroAppProps ?? {}) }, topKey) }) })) : null] }));
}
