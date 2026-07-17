/**
 * Web implementation of Viro3DObject — loads a GLB/glTF/VRX model into a node.
 * Fetches the model bytes, writes them to the WASM virtual FS, and invokes the
 * native loader. Transform props apply to the containing node.
 *
 * Model animations become available after load; drive them via ViroAnimations
 * (follow-up). OBJ and external-resource glTF are not supported yet.
 */
import * as React from "react";
import { useEffect, useState } from "react";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroAnimation, type ViroAnimationProp } from "./Web/useViroAnimation";
import { useViroRenderer, ViroParentNodeContext } from "./Web/ViroWebContext";
import {
  resolveModelSource,
  modelFormatFor,
  fetchModelBytes,
  resourceName,
} from "./Web/viroModelLoader";

type Props = ViroWebNodeProps & {
  source: unknown;
  type?: string; // "GLB" | "GLTF" | "VRX"
  resources?: unknown[]; // external files (e.g. VRX textures) referenced by name
  animation?: ViroAnimationProp;
  onLoadStart?: () => void;
  onLoadEnd?: (success?: boolean) => void;
  onError?: (error: unknown) => void;
  children?: React.ReactNode;
  [key: string]: any;
};

export function Viro3DObject(props: Props) {
  const node = useViroNode(props);
  const renderer = useViroRenderer();
  const [loaded, setLoaded] = useState(false);

  // Model animations become available once the model has loaded.
  useViroAnimation(node, props.animation, loaded);

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

  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
