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
 * slam-wasm is loaded as a classic <script> exposing a global `SlamModule`
 * factory (matches the slam web build: MODULARIZE + EXPORT_NAME='SlamModule').
 * Override via the `loadSlam` prop for bundler/ESM setups.
 *
 * MVP scope: single scene; camera + 6-DoF pose tracking. Planes/hit-test are a
 * follow-up.
 */
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ViroWebRenderer,
  ViroArSession,
  ViroTrackingState,
  requestDeviceMotionPermission,
  type ViroHandle,
  type ViroWebRendererOptions,
  type ViroArSessionOptions,
  type SlamWasmFactory,
} from "@reactvision/viro-web-renderer";
import {
  ViroRendererContext,
  ViroParentNodeContext,
  ViroARContext,
} from "../Web/ViroWebContext";
import type { ArPlaneAnchor } from "@reactvision/viro-web-renderer";
import { resetMaterialCache } from "../Web/viroMaterialRegistry";

/** AR capture/tuning knobs forwarded to the ViroArSession. */
type ArOptions = Partial<
  Pick<
    ViroArSessionOptions,
    | "captureWidth"
    | "captureHeight"
    | "facingMode"
    | "intrinsics"
    | "tuning"
    | "showCameraBackground"
    | "detectPlanes"
    | "maxPlanes"
    | "renderWhileLimited"
  >
>;

type Props = {
  initialScene: { scene: React.ComponentType<any> };
  viroAppProps?: any;
  /** WASM renderer asset-loading options (bundler/ESM). See Viro3DSceneNavigator.web. */
  webRendererOptions?: Omit<ViroWebRendererOptions, "canvas">;
  /**
   * URL to the slam-wasm glue (slam_wasm.js). Injected as a <script>; the build
   * exposes a global `SlamModule` factory. Ignored if `loadSlam` is provided.
   */
  slamScriptUrl?: string;
  /** Override how the slam-wasm factory is obtained (e.g. an ESM import()). */
  loadSlam?: ViroArSessionOptions["loadSlam"];
  /** Capture/tuning options for tracking. */
  arOptions?: ArOptions;
  /** Overlay label for the start button. */
  startLabel?: string;
  [key: string]: any;
};

const containerStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  overflow: "hidden",
};
const canvasStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  touchAction: "none",
};
const overlayStyle: React.CSSProperties = {
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
const buttonStyle: React.CSSProperties = {
  padding: "12px 28px",
  fontSize: 16,
  fontWeight: 600,
  color: "#000",
  background: "#fff",
  border: "none",
  borderRadius: 999,
  cursor: "pointer",
};
const statusStyle: React.CSSProperties = {
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
let slamScriptPromise: Promise<SlamWasmFactory> | null = null;
function loadSlamViaScript(url: string): Promise<SlamWasmFactory> {
  if (slamScriptPromise) return slamScriptPromise;
  slamScriptPromise = new Promise<SlamWasmFactory>((resolve, reject) => {
    const existing = (globalThis as any).SlamModule as SlamWasmFactory | undefined;
    if (existing) {
      resolve(existing);
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => {
      const factory = (globalThis as any).SlamModule as SlamWasmFactory | undefined;
      if (factory) resolve(factory);
      else reject(new Error(`slam script loaded but global 'SlamModule' is missing: ${url}`));
    };
    script.onerror = () => reject(new Error(`failed to load slam script: ${url}`));
    document.head.appendChild(script);
  });
  return slamScriptPromise;
}

function trackingLabel(state: ViroTrackingState): string {
  switch (state) {
    case ViroTrackingState.Normal:
      return "Tracking";
    case ViroTrackingState.Limited:
      return "Inicializando…";
    default:
      return "Buscando tracking…";
  }
}

export function ViroARSceneNavigator(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderer, setRenderer] = useState<ViroWebRenderer | null>(null);
  const [rootNode, setRootNode] = useState<ViroHandle>(0);
  const sessionRef = useRef<ViroArSession | null>(null);

  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<ViroTrackingState>(ViroTrackingState.Unavailable);
  const [anchors, setAnchors] = useState<ArPlaneAnchor[]>([]);

  useEffect(() => {
    let cancelled = false;
    let created: ViroWebRenderer | null = null;
    (async () => {
      if (!canvasRef.current) return;
      try {
        created = await ViroWebRenderer.create({
          canvas: canvasRef.current,
          ...props.webRendererOptions,
        });
        if (cancelled) {
          created.dispose();
          return;
        }
        setRootNode(created.scene.getRootNode());
        setRenderer(created);
      } catch (err) {
        console.error("[Viro web AR] failed to initialize renderer:", err);
        setError("No se pudo inicializar el renderer.");
      }
    })();
    return () => {
      cancelled = true;
      sessionRef.current?.stop();
      sessionRef.current = null;
      created?.dispose();
      resetMaterialCache();
    };
  }, []);

  // Keep the renderer's viewport in sync with the canvas size.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!renderer || !canvas) return;
    const observer = new ResizeObserver(() => renderer.resize());
    observer.observe(canvas);
    renderer.resize();
    return () => observer.disconnect();
  }, [renderer]);

  const resolveLoadSlam = useCallback((): ViroArSessionOptions["loadSlam"] => {
    if (props.loadSlam) return props.loadSlam;
    const url = props.slamScriptUrl;
    if (url) return () => loadSlamViaScript(url);
    // Fall back to a pre-loaded global (host injected the <script> itself).
    return () => {
      const factory = (globalThis as any).SlamModule as SlamWasmFactory | undefined;
      if (!factory) {
        throw new Error(
          "slam-wasm not found: pass slamScriptUrl or loadSlam, or preload global SlamModule.",
        );
      }
      return factory;
    };
  }, [props.loadSlam, props.slamScriptUrl]);

  const startAR = useCallback(async () => {
    if (!renderer || starting || started) return;
    setStarting(true);
    setError(null);
    // Request DeviceMotion permission from within this tap (required on iOS).
    await requestDeviceMotionPermission();
    const session = new ViroArSession({
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
    await session.start();
    setStarted(true);
    setStarting(false);
  }, [renderer, starting, started, resolveLoadSlam, props.arOptions]);

  const SceneComponent = props.initialScene?.scene;

  const sceneNavigator = {
    push: () => {},
    pop: () => {},
    popN: () => {},
    jump: () => {},
    replace: () => {},
    viroAppProps: props.viroAppProps ?? {},
  };

  return (
    <div style={containerStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />

      {renderer && rootNode && SceneComponent ? (
        <ViroRendererContext.Provider value={renderer}>
          <ViroARContext.Provider
            value={{ session: sessionRef.current, anchors, trackingState: tracking }}
          >
            <ViroParentNodeContext.Provider value={rootNode}>
              <SceneComponent sceneNavigator={sceneNavigator} {...props.viroAppProps} />
            </ViroParentNodeContext.Provider>
          </ViroARContext.Provider>
        </ViroRendererContext.Provider>
      ) : null}

      {started ? (
        <div style={statusStyle}>{trackingLabel(tracking)}</div>
      ) : (
        <div style={overlayStyle}>
          {error ? <div style={{ color: "#ff8080" }}>{error}</div> : null}
          <div>{props.startLabel ?? "AR en la web · cámara + tracking"}</div>
          <button
            type="button"
            style={buttonStyle}
            disabled={!renderer || starting}
            onClick={startAR}
          >
            {starting ? "Iniciando…" : "Iniciar AR"}
          </button>
        </div>
      )}
    </div>
  );
}
