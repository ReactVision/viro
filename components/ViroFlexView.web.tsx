/**
 * Web implementation of ViroFlexView — a rectangular container in 3D space with
 * an optional background (color or materials), sized by `style.width`/`height`.
 * Children render under the container node.
 *
 * MVP scope: sized container + background + children. Automatic flexbox layout
 * (flexDirection/justifyContent/alignItems/padding) is a follow-up — children
 * position themselves via their own transform for now.
 */
import * as React from "react";
import { useEffect, useRef } from "react";
import {
  ViroLightingModel,
  type ViroHandle,
} from "@reactvision/viro-web-renderer";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroScene, ViroParentNodeContext } from "./Web/ViroWebContext";
import { parseColorToRGBA } from "./Web/viroColor";
import { createMaterialFromRegistry } from "./Web/viroMaterialRegistry";

type Props = ViroWebNodeProps & {
  style?: { width?: number; height?: number; backgroundColor?: string } & Record<string, unknown>;
  width?: number;
  height?: number;
  materials?: string | string[];
  children?: React.ReactNode;
  [key: string]: any;
};

export function ViroFlexView(props: Props) {
  const scene = useViroScene();
  const width = props.style?.width ?? props.width ?? 1;
  const height = props.style?.height ?? props.height ?? 1;
  const backgroundColor = props.style?.backgroundColor;
  const materialName = Array.isArray(props.materials) ? props.materials[0] : props.materials;

  const container = useViroNode(props);

  // Background quad (a child node) from backgroundColor or a named material.
  const bgRef = useRef<{ node: ViroHandle; geo: ViroHandle; material: ViroHandle }>({
    node: 0,
    geo: 0,
    material: 0,
  });
  useEffect(() => {
    if (!container || (!backgroundColor && !materialName)) return;

    const node = scene.createNode();
    const geo = scene.createSurface(width, height);
    scene.setNodeGeometry(node, geo);

    let material = 0;
    if (materialName) {
      material = createMaterialFromRegistry(scene, materialName);
    } else if (backgroundColor) {
      material = scene.createMaterial();
      scene.setMaterialLightingModel(material, ViroLightingModel.Constant);
      const [r, g, b, a] = parseColorToRGBA(backgroundColor);
      scene.setMaterialDiffuseColor(material, r, g, b, a);
    }
    if (material) scene.setGeometryMaterial(geo, material);
    scene.addChildNode(container, node);
    bgRef.current = { node, geo, material };

    return () => {
      const bg = bgRef.current;
      scene.removeNodeFromParent(bg.node);
      if (bg.material) scene.destroyMaterial(bg.material);
      if (bg.geo) scene.destroyGeometry(bg.geo);
      if (bg.node) scene.destroyNode(bg.node);
      bgRef.current = { node: 0, geo: 0, material: 0 };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container, width, height, backgroundColor, materialName]);

  return (
    <ViroParentNodeContext.Provider value={container}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
