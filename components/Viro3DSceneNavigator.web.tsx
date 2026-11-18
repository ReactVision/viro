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
import { useEffect, useRef, useState } from "react";
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

type Props = {
  initialScene: { scene: React.ComponentType<any>; passProps?: Record<string, unknown> };
  viroAppProps?: any;
  /**
   * How to load the WASM renderer assets. Required under bundlers that rewrite
   * import.meta.url (e.g. Vite/webpack): pass importGlue + locateFile, or an
   * assetBaseUrl. Omit for direct-ESM hosting where the package self-resolves.
   */
  webRendererOptions?: Omit<ViroWebRendererOptions, "canvas">;
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
  const [renderer, setRenderer] = useState<ViroWebRenderer | null>(null);
  useViroRendererEffects(renderer, props);
  const [rootNode, setRootNode] = useState<ViroHandle>(0);

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
        console.error("[Viro web] failed to initialize renderer:", err);
      }
    })();
    return () => {
      cancelled = true;
      created?.dispose();
      resetMaterialCache();
    };
  }, []);

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
    viroAppProps: props.viroAppProps ?? {},
  };
  const top = history[history.length - 1];
  const SceneComponent = top?.scene;

  return (
    <div style={containerStyle}>
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
    </div>
  );
}
