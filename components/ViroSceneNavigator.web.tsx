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

type SceneDescriptor = { scene: React.ComponentType<any>; passProps?: any };

type Props = {
  initialScene: SceneDescriptor;
  initialSceneKey?: string;
  viroAppProps?: any;
  vrModeEnabled?: boolean; // no-op on web
  onExitViro?: () => void; // no-op on web
  webRendererOptions?: Omit<ViroWebRendererOptions, "canvas">;
  [key: string]: any;
};

type Stack = {
  dict: Record<string, SceneDescriptor>;
  history: string[];
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

let tagCounter = 0;
function randomTag(): string {
  tagCounter += 1;
  return `viro-scene-${tagCounter}-${Math.floor(Math.random() * 1e9)}`;
}

/** Normalise the native push/replace/jump (key?, scene?) overloads. */
function resolveArgs(
  param1?: string | SceneDescriptor,
  param2?: string | SceneDescriptor,
): { key: string; descriptor?: SceneDescriptor } {
  let key: string | undefined;
  let descriptor: SceneDescriptor | undefined;
  if (typeof param1 === "string") {
    key = param1;
    descriptor = param2 as SceneDescriptor | undefined;
  } else {
    descriptor = param1 as SceneDescriptor | undefined;
  }
  if (!key || key.trim().length === 0) key = randomTag();
  return { key, descriptor };
}

export function ViroSceneNavigator(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderer, setRenderer] = useState<ViroWebRenderer | null>(null);
  const [rootNode, setRootNode] = useState<ViroHandle>(0);

  const [stack, setStack] = useState<Stack>(() => {
    const key = props.initialSceneKey ?? randomTag();
    return { dict: { [key]: props.initialScene }, history: [key] };
  });

  // Renderer bootstrap — identical to Viro3DSceneNavigator.web.
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!renderer || !canvas) return;
    const observer = new ResizeObserver(() => renderer.resize());
    observer.observe(canvas);
    renderer.resize();
    return () => observer.disconnect();
  }, [renderer]);

  // Scene-stack operations. Each mutates the keyed dictionary + history; the
  // rendered scene is always the last key in history.
  const sceneNavigatorRef = useRef({
    push: (p1?: string | SceneDescriptor, p2?: string | SceneDescriptor) => {
      setStack((prev) => {
        const { key, descriptor } = resolveArgs(p1, p2);
        const dict = { ...prev.dict };
        if (descriptor) dict[key] = descriptor;
        if (!dict[key]) {
          console.warn(`[Viro web] push: no scene registered for key "${key}"`);
          return prev;
        }
        return { dict, history: [...prev.history, key] };
      });
    },
    replace: (p1?: string | SceneDescriptor, p2?: string | SceneDescriptor) => {
      setStack((prev) => {
        const { key, descriptor } = resolveArgs(p1, p2);
        const dict = { ...prev.dict };
        if (descriptor) dict[key] = descriptor;
        if (!dict[key]) {
          console.warn(`[Viro web] replace: no scene registered for key "${key}"`);
          return prev;
        }
        const history = prev.history.slice(0, -1);
        return { dict, history: [...history, key] };
      });
    },
    pop: () => sceneNavigatorRef.current.popN(1),
    popN: (n: number) => {
      setStack((prev) => {
        if (n <= 0) return prev;
        if (prev.history.length - n <= 0) {
          console.warn("[Viro web] Attempted to pop the root scene in ViroSceneNavigator!");
          return prev;
        }
        return { dict: prev.dict, history: prev.history.slice(0, prev.history.length - n) };
      });
    },
    jump: (p1?: string | SceneDescriptor, p2?: string | SceneDescriptor) => {
      setStack((prev) => {
        const { key, descriptor } = resolveArgs(p1, p2);
        const dict = { ...prev.dict };
        if (descriptor) dict[key] = descriptor;
        if (!dict[key]) {
          console.warn(`[Viro web] jump: no scene registered for key "${key}"`);
          return prev;
        }
        const history = prev.history.filter((k) => k !== key);
        return { dict, history: [...history, key] };
      });
    },
    recenterTracking: () => {}, // no VR recenter on web
    project: async (point: [number, number, number]) =>
      (renderer as any)?.project?.(point) ?? point,
    unproject: async (point: [number, number, number]) =>
      (renderer as any)?.unproject?.(point) ?? point,
    viroAppProps: props.viroAppProps ?? {},
  });
  sceneNavigatorRef.current.viroAppProps = props.viroAppProps ?? {};

  const topKey = stack.history[stack.history.length - 1];
  const descriptor = stack.dict[topKey];
  const SceneComponent = descriptor?.scene;

  return (
    <div style={containerStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />
      {renderer && rootNode && SceneComponent ? (
        <ViroRendererContext.Provider value={renderer}>
          <ViroParentNodeContext.Provider value={rootNode}>
            <SceneComponent
              key={topKey}
              sceneNavigator={sceneNavigatorRef.current}
              {...(descriptor?.passProps ?? {})}
              {...(props.viroAppProps ?? {})}
            />
          </ViroParentNodeContext.Provider>
        </ViroRendererContext.Provider>
      ) : null}
    </div>
  );
}
