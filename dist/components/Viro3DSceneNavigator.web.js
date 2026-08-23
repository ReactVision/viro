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
exports.Viro3DSceneNavigator = Viro3DSceneNavigator;
/**
 * Web implementation of Viro3DSceneNavigator. Owns the <canvas> and the
 * ViroWebRenderer (WASM host), and provides the renderer + scene root node to
 * the component tree via context. Scenes render their children as C-API-backed
 * nodes rather than native views.
 *
 * MVP scope: renders the initial scene; multi-scene push/pop navigation is a
 * follow-up (the API surface is stubbed so scenes can mount).
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
function Viro3DSceneNavigator(props) {
    const canvasRef = (0, react_1.useRef)(null);
    const [renderer, setRenderer] = (0, react_1.useState)(null);
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
    return (<div style={containerStyle}>
      <canvas ref={canvasRef} style={canvasStyle}/>
      {renderer && rootNode && SceneComponent ? (<ViroWebContext_1.ViroRendererContext.Provider value={renderer}>
          <ViroWebContext_1.ViroParentNodeContext.Provider value={rootNode}>
            <SceneComponent sceneNavigator={sceneNavigator} {...props.viroAppProps}/>
          </ViroWebContext_1.ViroParentNodeContext.Provider>
        </ViroWebContext_1.ViroRendererContext.Provider>) : null}
    </div>);
}
