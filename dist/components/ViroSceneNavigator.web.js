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
exports.ViroSceneNavigator = ViroSceneNavigator;
/**
 * ViroSceneNavigator.web.tsx
 *
 * Web implementation of ViroSceneNavigator — the non-AR, multi-scene navigator.
 * Owns the <canvas> and the ViroWebRenderer (WASM host) exactly like
 * Viro3DSceneNavigator.web, and adds a real scene stack (push/pop/popN/jump/
 * replace) on top. Only the top-of-stack scene is mounted against the single
 * WASM scene root; navigating swaps which scene's children build C-API nodes.
 *
 * VR-specific surface has no web counterpart and is a graceful no-op:
 * `vrModeEnabled`, `onExitViro`, and `recenterTracking` do nothing on web
 * (there is no headset target). `project`/`unproject` are provided by the
 * renderer where available.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
const React = __importStar(require("react"));
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
    return (<div style={containerStyle}>
      <canvas ref={canvasRef} style={canvasStyle}/>
      {renderer && rootNode && SceneComponent ? (<ViroWebContext_1.ViroRendererContext.Provider value={renderer}>
          <ViroWebContext_1.ViroParentNodeContext.Provider value={rootNode}>
            <SceneComponent key={topKey} sceneNavigator={sceneNavigatorRef.current} {...(descriptor?.passProps ?? {})} {...(props.viroAppProps ?? {})}/>
          </ViroWebContext_1.ViroParentNodeContext.Provider>
        </ViroWebContext_1.ViroRendererContext.Provider>) : null}
    </div>);
}
