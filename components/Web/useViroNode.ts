/**
 * Shared lifecycle hook for web node components. Creates a native node (and
 * optional geometry) via the C API, parents it under the enclosing node, applies
 * transform/material props, and tears down on unmount.
 *
 * The node handle is created in a lazy useState initializer so it exists on the
 * first render — children read it from context and parent themselves correctly
 * even though React runs child effects before parent effects.
 */
import { useState, useEffect, useRef } from "react";
import type { ViroHandle, ViroSceneApi } from "@reactvision/viro-web-renderer";
import { useViroScene, useViroParentNode } from "./ViroWebContext";
import { createMaterialFromRegistry } from "./viroMaterialRegistry";

const DEG2RAD = Math.PI / 180;

export interface ViroWebNodeProps {
  position?: [number, number, number];
  rotation?: [number, number, number]; // degrees, Viro convention
  scale?: [number, number, number];
  opacity?: number;
  visible?: boolean;
  materials?: string | string[];
}

export function useViroNode(
  props: ViroWebNodeProps,
  createGeometry?: (scene: ViroSceneApi) => ViroHandle,
): ViroHandle {
  const scene = useViroScene();
  const parent = useViroParentNode();

  const [node] = useState<ViroHandle>(() => scene.createNode());
  const geometryRef = useRef<ViroHandle>(0);

  // Create geometry + attach to parent once; destroy on unmount.
  useEffect(() => {
    if (createGeometry) {
      const geo = createGeometry(scene);
      geometryRef.current = geo;
      scene.setNodeGeometry(node, geo);
    }
    scene.addChildNode(parent, node);
    return () => {
      scene.removeNodeFromParent(node);
      if (geometryRef.current) {
        scene.destroyGeometry(geometryRef.current);
      }
      scene.destroyNode(node);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Transform + visibility props.
  const [px, py, pz] = props.position ?? [0, 0, 0];
  const [rx, ry, rz] = props.rotation ?? [0, 0, 0];
  const [sx, sy, sz] = props.scale ?? [1, 1, 1];
  const opacity = props.opacity ?? 1;
  const visible = props.visible ?? true;

  useEffect(() => {
    scene.setNodePosition(node, px, py, pz);
    scene.setNodeRotation(node, rx * DEG2RAD, ry * DEG2RAD, rz * DEG2RAD);
    scene.setNodeScale(node, sx, sy, sz);
    scene.setNodeOpacity(node, opacity);
    scene.setNodeVisible(node, visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, px, py, pz, rx, ry, rz, sx, sy, sz, opacity, visible]);

  // Materials (first material applied to the geometry; MVP scope).
  const materialsKey = Array.isArray(props.materials)
    ? props.materials.join(",")
    : props.materials ?? "";
  useEffect(() => {
    const geo = geometryRef.current;
    if (!geo || !materialsKey) return;
    const firstName = materialsKey.split(",")[0];
    const material = createMaterialFromRegistry(scene, firstName);
    if (material) {
      scene.setGeometryMaterial(geo, material);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, materialsKey]);

  return node;
}
