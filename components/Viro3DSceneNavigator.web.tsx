/**
 * Web implementation of Viro3DSceneNavigator. Owns the <canvas> and the
 * ViroWebRenderer (WASM host), and provides the renderer + scene root node to
 * the component tree via context. Scenes render their children as C-API-backed
 * nodes rather than native views.
 *
 * MVP scope: renders the initial scene; multi-scene push/pop navigation is a
 * follow-up (the API surface is stubbed so scenes can mount).
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

type Props = {
  initialScene: { scene: React.ComponentType<any> };
  viroAppProps?: any;
  /**
   * How to load the WASM renderer assets. Required under bundlers that rewrite
   * import.meta.url (e.g. Vite/webpack): pass importGlue + locateFile, or an
   * assetBaseUrl. Omit for direct-ESM hosting where the package self-resolves.
   */
  webRendererOptions?: Omit<ViroWebRendererOptions, "canvas">;
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

export function Viro3DSceneNavigator(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderer, setRenderer] = useState<ViroWebRenderer | null>(null);
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

  // Minimal sceneNavigator surface so scenes can mount (navigation is a follow-up).
  const sceneNavigator = {
    push: () => {},
    pop: () => {},
    popN: () => {},
    jump: () => {},
    replace: () => {},
    viroAppProps: props.viroAppProps ?? {},
  };

  const SceneComponent = props.initialScene?.scene;

  return (
    <div style={containerStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />
      {renderer && rootNode && SceneComponent ? (
        <ViroRendererContext.Provider value={renderer}>
          <ViroParentNodeContext.Provider value={rootNode}>
            <SceneComponent sceneNavigator={sceneNavigator} {...props.viroAppProps} />
          </ViroParentNodeContext.Provider>
        </ViroRendererContext.Provider>
      ) : null}
    </div>
  );
}
