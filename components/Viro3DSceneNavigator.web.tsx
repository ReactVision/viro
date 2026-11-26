/**
 * Web implementation of Viro3DSceneNavigator. Owns the <canvas> and the
 * ViroWebRenderer (WASM host), and provides the renderer + scene root node to
 * the component tree via context. Scenes render their children as C-API-backed
 * nodes rather than native views.
 *
 * Only the top scene of the navigation stack is mounted; native keeps the
 * others, but nothing here can show them while they are covered.
 */
import * as React from "react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  ViroWebRenderer,
  type ViroHandle,
  type ViroWebRendererOptions,
} from "@reactvision/viro-web-renderer";
import {
  ViroRendererContext,
  ViroParentNodeContext,
} from "./Web/ViroWebContext";
import { resetMaterialCache } from "./Web/viroMaterialRegistry";
import { useViroContextRestore } from "./Web/useViroContextRestore";
import { defaultCameraView, installDefaultCamera, setCameraView } from "./Web/viroDrag";
import { projectPoint, requireScene, unprojectPoint } from "./Web/viroProjection";
import { useViroWebCapture } from "./Web/viroCapture";
import { useViroUsagePing } from "./Utilities/ViroUsagePing";
import {
  useViroRendererEffects,
  type ViroRendererEffectProps,
} from "./Web/useViroRendererEffects";
import {
  jumpToScene,
  popScenes,
  pushScene,
  replaceScene,
  type WebSceneEntry,
} from "./Web/webSceneStack";
import { attachVirtualCamera3D, type ViroVirtualCameraOptions } from "./Web/viroVirtualCamera";
import { ViroWebStartError, webRendererStartMessage } from "./Web/viroStartError";

type Props = {
  initialScene: { scene: React.ComponentType<any>; passProps?: Record<string, unknown> };
  viroAppProps?: any;
  /**
   * How to load the WASM renderer assets. Required under bundlers that rewrite
   * import.meta.url (e.g. Vite/webpack): pass importGlue + locateFile, or an
   * assetBaseUrl. Omit for direct-ESM hosting where the package self-resolves.
   */
  webRendererOptions?: Omit<ViroWebRendererOptions, "canvas">;
  /**
   * Web only: the renderer could not start, e.g. no WebGL2 (a
   * ViroWebGLUnavailableError). The navigator also shows a message over the canvas.
   */
  onWebRendererError?: (error: unknown) => void;
  /**
   * Web only: the mouse or two fingers move the point of view (see
   * viroVirtualCamera.ts), until the scene makes one of its own ViroCameras
   * the point of view.
   */
  virtualCamera?: boolean | Omit<ViroVirtualCameraOptions, "floorY">;
  [key: string]: any;
} & ViroRendererEffectProps;

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

export function Viro3DSceneNavigator(props: Props) {
  useViroUsagePing("3d", {
    hdr_enabled: props.hdrEnabled,
    pbr_enabled: props.pbrEnabled,
    bloom_enabled: props.bloomEnabled,
    shadows_enabled: props.shadowsEnabled,
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const capture = useViroWebCapture(canvasRef);
  const containerRef = useRef<HTMLDivElement>(null);
  const virtual = props.virtualCamera ? (props.virtualCamera === true ? {} : props.virtualCamera) : null;
  const virtualRef = useRef(virtual);
  virtualRef.current = virtual;
  const [renderer, setRenderer] = useState<ViroWebRenderer | null>(null);
  useViroRendererEffects(renderer, props);
  const [rootNode, setRootNode] = useState<ViroHandle>(0);
  const [startError, setStartError] = useState<string | null>(null);

  const generation = useViroContextRestore(renderer, () => {
    setRenderer(null);
    setRootNode(0);
  });
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
        setStartError(null);
        setRootNode(created.scene.getRootNode());
        setRenderer(created);
      } catch (err) {
        console.error("[Viro web] failed to initialize renderer:", err);
        if (cancelled) return;
        setStartError(webRendererStartMessage(err));
        props.onWebRendererError?.(err);
      }
    })();
    return () => {
      cancelled = true;
      created?.dispose();
      resetMaterialCache();
    };
  }, [generation]);

  // What dragging casts its rays through, until a camera component takes over.
  // The virtual camera publishes its own view.
  const virtualOn = virtual !== null;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!renderer || !canvas || virtualOn) return;
    setCameraView(renderer.scene, defaultCameraView(canvas));
    return () => setCameraView(renderer.scene, null);
  }, [renderer, virtualOn]);
  // What a released ViroCamera returns to.
  useEffect(() => (renderer && rootNode ? installDefaultCamera(renderer.scene, rootNode) : undefined), [renderer, rootNode]);

  // Keep the renderer's viewport in sync with the canvas size (fixes aspect
  // distortion on layout/window resize). ResizeObserver catches container
  // changes, not just window resizes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!renderer || !canvas) return;
    const observer = new ResizeObserver(() => renderer.resize());
    observer.observe(canvas);
    renderer.resize(); // correct the initial size once mounted/laid out
    return () => observer.disconnect();
  }, [renderer]);

  useEffect(() => {
    const container = containerRef.current;
    const opts = virtualRef.current;
    if (!renderer || !rootNode || !container || !opts) return;
    return attachVirtualCamera3D(renderer.scene, rootNode, container, opts);
  }, [renderer, rootNode, virtualOn]);

  const [history, setHistory] = useState<WebSceneEntry[]>(() =>
    props.initialScene?.scene
      ? [{ key: "initial", scene: props.initialScene.scene, passProps: props.initialScene.passProps }]
      : [],
  );
  const sceneNavigator = {
    push: (a?: unknown, b?: unknown) => setHistory((h) => pushScene(h, a, b)),
    replace: (a?: unknown, b?: unknown) => setHistory((h) => replaceScene(h, a, b)),
    jump: (a?: unknown, b?: unknown) => setHistory((h) => jumpToScene(h, a, b)),
    pop: () => setHistory((h) => popScenes(h, 1)),
    popN: (n: number) => setHistory((h) => popScenes(h, n)),
    // Recentering re-zeroes a headset's yaw; there is no headset here.
    recenterTracking: () => {},
    project: async (point: number[]) => projectPoint(requireScene(renderer), point),
    unproject: async (point: number[]) => unprojectPoint(requireScene(renderer), point),
    takeScreenshot: capture.takeScreenshot,
    startVideoRecording: capture.startVideoRecording,
    stopVideoRecording: capture.stopVideoRecording,
    viroAppProps: props.viroAppProps ?? {},
  };
  useImperativeHandle(props.ref, () => ({ sceneNavigator }));
  const top = history[history.length - 1];
  const SceneComponent = top?.scene;

  return (
    <div ref={containerRef} style={containerStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />
      {renderer && rootNode && SceneComponent ? (
        <ViroRendererContext.Provider value={renderer}>
          <ViroParentNodeContext.Provider value={rootNode}>
            <SceneComponent
              key={top.key}
              sceneNavigator={sceneNavigator}
              {...props.viroAppProps}
              {...top.passProps}
            />
          </ViroParentNodeContext.Provider>
        </ViroRendererContext.Provider>
      ) : null}
      <ViroWebStartError message={startError} />
    </div>
  );
}
