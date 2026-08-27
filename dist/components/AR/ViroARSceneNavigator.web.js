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
exports.ViroARSceneNavigator = ViroARSceneNavigator;
/**
 * Web implementation of ViroARSceneNavigator. Owns the <canvas> + ViroWebRenderer
 * (WASM host, virocore) and drives a ViroArSession which runs slam-wasm to track
 * the device and inject poses into the renderer. Scenes render their children as
 * C-API-backed nodes via context, exactly like Viro3DSceneNavigator.web.
 *
 * Web AR needs a user gesture: getUserMedia and (on iOS Safari) DeviceMotion
 * permission can only be requested from a tap. So we render a "Start AR" overlay
 * and begin tracking on tap.
 *
 * The tracking engine is loaded as a classic <script> exposing a global
 * `SlamModule` factory (MODULARIZE + EXPORT_NAME='SlamModule'). That engine is
 * tinyvio, built through its platforms/slam drop-in C API — the name is the
 * interface's, not the implementation's, and keeping it is why this file did
 * not change when the engine did. Override via `loadSlam` for ESM setups.
 *
 * MVP scope: single scene; camera + 6-DoF pose tracking. Planes/hit-test are a
 * follow-up.
 */
const React = __importStar(require("react"));
const react_1 = require("react");
const viro_web_renderer_1 = require("@reactvision/viro-web-renderer");
const ViroWebContext_1 = require("../Web/ViroWebContext");
const viroMaterialRegistry_1 = require("../Web/viroMaterialRegistry");
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
const overlayStyle = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    font: "500 16px system-ui, sans-serif",
    textAlign: "center",
    padding: 24,
};
const buttonStyle = {
    padding: "12px 28px",
    fontSize: 16,
    fontWeight: 600,
    color: "#000",
    background: "#fff",
    border: "none",
    borderRadius: 999,
    cursor: "pointer",
};
const statusStyle = {
    position: "absolute",
    top: 12,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "6px 14px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.5)",
    color: "#fff",
    font: "500 13px system-ui, sans-serif",
    pointerEvents: "none",
};
// Load slam-wasm as a classic script exposing a global `SlamModule` factory.
let slamScriptPromise = null;
function loadSlamViaScript(url) {
    if (slamScriptPromise)
        return slamScriptPromise;
    slamScriptPromise = new Promise((resolve, reject) => {
        const existing = globalThis.SlamModule;
        if (existing) {
            resolve(existing);
            return;
        }
        const script = document.createElement("script");
        script.src = url;
        script.async = true;
        script.onload = () => {
            const factory = globalThis.SlamModule;
            if (factory)
                resolve(factory);
            else
                reject(new Error(`slam script loaded but global 'SlamModule' is missing: ${url}`));
        };
        script.onerror = () => reject(new Error(`failed to load slam script: ${url}`));
        document.head.appendChild(script);
    });
    return slamScriptPromise;
}
function trackingLabel(state) {
    switch (state) {
        case viro_web_renderer_1.ViroTrackingState.Normal:
            return "Tracking";
        case viro_web_renderer_1.ViroTrackingState.Limited:
            return "Inicializando…";
        default:
            return "Buscando tracking…";
    }
}
function ViroARSceneNavigator(props) {
    const canvasRef = (0, react_1.useRef)(null);
    const [renderer, setRenderer] = (0, react_1.useState)(null);
    const [rootNode, setRootNode] = (0, react_1.useState)(0);
    const sessionRef = (0, react_1.useRef)(null);
    const [started, setStarted] = (0, react_1.useState)(false);
    const [starting, setStarting] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [tracking, setTracking] = (0, react_1.useState)(viro_web_renderer_1.ViroTrackingState.Unavailable);
    const [anchors, setAnchors] = (0, react_1.useState)([]);
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
                console.error("[Viro web AR] failed to initialize renderer:", err);
                setError("No se pudo inicializar el renderer.");
            }
        })();
        return () => {
            cancelled = true;
            sessionRef.current?.stop();
            sessionRef.current = null;
            created?.dispose();
            (0, viroMaterialRegistry_1.resetMaterialCache)();
        };
    }, []);
    // Keep the renderer's viewport in sync with the canvas size.
    (0, react_1.useEffect)(() => {
        const canvas = canvasRef.current;
        if (!renderer || !canvas)
            return;
        const observer = new ResizeObserver(() => renderer.resize());
        observer.observe(canvas);
        renderer.resize();
        return () => observer.disconnect();
    }, [renderer]);
    const resolveLoadSlam = (0, react_1.useCallback)(() => {
        if (props.loadSlam)
            return props.loadSlam;
        const url = props.slamScriptUrl;
        if (url)
            return () => loadSlamViaScript(url);
        // Fall back to a pre-loaded global (host injected the <script> itself).
        return () => {
            const factory = globalThis.SlamModule;
            if (!factory) {
                throw new Error("slam-wasm not found: pass slamScriptUrl or loadSlam, or preload global SlamModule.");
            }
            return factory;
        };
    }, [props.loadSlam, props.slamScriptUrl]);
    const startAR = (0, react_1.useCallback)(async () => {
        if (!renderer || starting || started)
            return;
        setStarting(true);
        setError(null);
        // Replay needs neither: no camera to open, no motion events to subscribe to.
        // Asking anyway would put a permission prompt in front of a preview that
        // cannot use the answer.
        if (!props.arOptions?.playback) {
            // Request DeviceMotion permission from within this tap (required on iOS).
            await (0, viro_web_renderer_1.requestDeviceMotionPermission)();
        }
        const session = new viro_web_renderer_1.ViroArSession({
            sceneApi: renderer.scene,
            loadSlam: resolveLoadSlam(),
            ...props.arOptions,
            onStatus: (state) => setTracking(state),
            onAnchorsUpdated: (next) => setAnchors(next),
            onError: (err) => {
                console.error("[Viro web AR] session error:", err);
                setError(err.message);
                setStarted(false);
                setStarting(false);
            },
        });
        sessionRef.current = session;
        // start() rejects when it cannot start, having already called onError with
        // the reason. Swallow the rejection here rather than letting it escape an
        // onClick handler, and above all do not fall through to setStarted(true):
        // that used to run even on a denied camera, undoing the state onError had
        // just set and leaving the UI claiming a session that does not exist.
        try {
            await session.start();
        }
        catch {
            sessionRef.current = null;
            return;
        }
        setStarted(true);
        setStarting(false);
        props.onSessionReady?.(session);
    }, [renderer, starting, started, resolveLoadSlam, props.arOptions, props.onSessionReady]);
    // Replay starts on its own. The button exists to satisfy a browser that will
    // not open a camera without a gesture; there is no camera here, and a preview
    // that waits for a click nobody is there to make would simply never render.
    (0, react_1.useEffect)(() => {
        // Waits for rootNode, not just for the renderer: the live path starts from a
        // tap, which happens long after the scene has mounted, and matching that
        // ordering costs nothing.
        if (props.arOptions?.playback && renderer && rootNode && !started && !starting) {
            void startAR();
        }
    }, [props.arOptions?.playback, renderer, rootNode, started, starting, startAR]);
    const SceneComponent = props.initialScene?.scene;
    const sceneNavigator = {
        push: () => { },
        pop: () => { },
        popN: () => { },
        jump: () => { },
        replace: () => { },
        viroAppProps: props.viroAppProps ?? {},
    };
    return (<div style={containerStyle}>
      <canvas ref={canvasRef} style={canvasStyle}/>

      {renderer && rootNode && SceneComponent ? (<ViroWebContext_1.ViroRendererContext.Provider value={renderer}>
          <ViroWebContext_1.ViroARContext.Provider value={{ session: sessionRef.current, anchors, trackingState: tracking }}>
            <ViroWebContext_1.ViroParentNodeContext.Provider value={rootNode}>
              <SceneComponent sceneNavigator={sceneNavigator} {...props.viroAppProps}/>
            </ViroWebContext_1.ViroParentNodeContext.Provider>
          </ViroWebContext_1.ViroARContext.Provider>
        </ViroWebContext_1.ViroRendererContext.Provider>) : null}

      {started ? (<div style={statusStyle}>{trackingLabel(tracking)}</div>) : (<div style={overlayStyle}>
          {error ? <div style={{ color: "#ff8080" }}>{error}</div> : null}
          <div>{props.startLabel ?? "AR en la web · cámara + tracking"}</div>
          <button type="button" style={buttonStyle} disabled={!renderer || starting} onClick={startAR}>
            {starting ? "Iniciando…" : "Iniciar AR"}
          </button>
        </div>)}
    </div>);
}
