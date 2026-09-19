/**
 * Web implementation of Viro3DObject — loads a GLB/glTF/VRX/OBJ model into a
 * node. Fetches the model bytes, writes them to the WASM virtual FS, and invokes
 * the native loader. Transform props apply to the containing node.
 *
 * Model animations become available after load; drive them via ViroAnimations
 * (follow-up).
 *
 * OBJ is not self-contained: pass its .mtl through `resources`, along with every
 * texture that .mtl names. They are matched by basename, exactly as on native,
 * so the URLs may live anywhere as long as the final path segments match the
 * names inside the files.
 */
import * as React from "react";
import { useEffect, useState } from "react";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import type { ViroAnimationProp } from "./Web/useViroAnimation";
import {
  useViroRenderer,
  useViroScene,
  ViroParentNodeContext,
} from "./Web/ViroWebContext";
import {
  resolveModelSource,
  modelFormatFor,
  fetchModelBytes,
  resourceName,
} from "./Web/viroModelLoader";

type Props = ViroWebNodeProps & {
  source: unknown;
  type?: string; // "GLB" | "GLTF" | "VRX" | "OBJ"
  resources?: unknown[]; // external files (an OBJ's .mtl, textures) referenced by name
  animation?: ViroAnimationProp;
  /**
   * Blend-shape weights, by the target names the model was exported with. Same
   * shape as native's: `[{ target: "Smile", weight: 0.8 }]`.
   */
  morphTargets?: Array<{ target?: string; weight?: number }>;
  /** Where the blending runs. Native's default is the CPU path. */
  morphMode?: "cpu" | "gpu" | "hybrid";
  /** The names this model morphs by, once it has loaded. */
  onMorphTargets?: (keys: string[]) => void;
  onLoadStart?: () => void;
  onLoadEnd?: (success?: boolean) => void;
  onError?: (error: unknown) => void;
  children?: React.ReactNode;
  [key: string]: any;
};

export function Viro3DObject(props: Props) {
  const [loaded, setLoaded] = useState(false);
  // `loaded` is the hook's contentReady: the model's own animations and any
  // shader override both need its subtree to exist first.
  const node = useViroNode(props, undefined, loaded);
  const renderer = useViroRenderer();

  const url = resolveModelSource(props.source);
  const { onLoadStart, onLoadEnd, onError, type } = props;
  const resourceUrls = (props.resources ?? [])
    .map(resolveModelSource)
    .filter((u): u is string => !!u);
  const resourcesKey = resourceUrls.join(",");

  useEffect(() => {
    if (!url) {
      console.warn("[Viro web] Viro3DObject: unresolved source", props.source);
      return;
    }
    let cancelled = false;
    const format = modelFormatFor(url, type);
    onLoadStart?.();

    (async () => {
      const [bytes, resources] = await Promise.all([
        fetchModelBytes(url),
        Promise.all(
          resourceUrls.map(async (resUrl) => ({
            name: resourceName(resUrl),
            bytes: await fetchModelBytes(resUrl),
          })),
        ),
      ]);
      if (cancelled) return false;
      return renderer.loadModel(node, bytes, format, resources);
    })()
      .then((success) => {
        if (cancelled) return;
        if (success) {
          setLoaded(true);
          onLoadEnd?.(true);
        } else {
          onError?.(new Error("model load failed"));
        }
      })
      .catch((err) => {
        if (!cancelled) onError?.(err);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, url, type, resourcesKey]);

  // Morph targets, once the model's meshes exist: virocore hangs a morpher off
  // each mesh as it loads, so a weight set before that reaches nothing.
  const scene = useViroScene();
  const { morphTargets, morphMode, onMorphTargets } = props;
  const morphKey = morphTargets
    ? morphTargets.map((t) => `${t.target}=${t.weight}`).join(",")
    : "";
  useEffect(() => {
    if (!loaded || !morphMode) return;
    scene.setMorphMode(node, morphMode);
  }, [scene, node, loaded, morphMode]);

  useEffect(() => {
    if (!loaded || !morphTargets) return;
    for (const { target, weight } of morphTargets) {
      if (typeof target !== "string") continue;
      scene.setMorphTargetWeight(node, target, weight ?? 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, node, loaded, morphKey]);

  useEffect(() => {
    if (!loaded || !onMorphTargets) return;
    onMorphTargets(scene.getMorphTargetKeys(node));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, node, loaded]);

  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
