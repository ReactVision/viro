/**
 * Web implementation of ViroFlexView — a rectangular container in 3D space with
 * an optional background (color or materials), sized by `style.width`/`height`,
 * that lays its children out with flexbox.
 *
 * The layout is measured, not computed here: see Web/viroFlexLayout. Each child
 * gets a node of its own, positioned at the frame the layout gave it, and its
 * measured size travels down the ViroFlexSlot context for the child to rebuild
 * its geometry from — which is the same pair native pushes onto a laid-out
 * child from VRTNode's recalcLayout.
 *
 * A child that declares `position` absolutely is still laid out; it is CSS
 * `position: absolute` that takes it out of flow, exactly as in a stylesheet.
 */
import * as React from "react";
import { useEffect, useMemo, useRef } from "react";
import {
  ViroLightingModel,
  type ViroHandle,
} from "@reactvision/viro-web-renderer";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroScene, ViroParentNodeContext } from "./Web/ViroWebContext";
import { parseColorToRGBA } from "./Web/viroColor";
import { createMaterialFromRegistry } from "./Web/viroMaterialRegistry";
import {
  measureFlexChildren,
  rectToSlot,
  FLEX_POINTS_PER_METER,
  type FlexSlot,
  type FlexStyle,
} from "./Web/viroFlexLayout";
import { ViroFlexSlotContext } from "./Web/ViroFlexSlotContext";
import { useViroFlexSlot } from "./Web/ViroFlexSlotContext";

type Props = ViroWebNodeProps & {
  style?: { width?: number; height?: number; backgroundColor?: string } & Record<string, unknown>;
  width?: number;
  height?: number;
  materials?: string | string[];
  children?: React.ReactNode;
  [key: string]: any;
};

/** One measured child: the node it hangs from and the size it was given. */
type ChildSlot = { node: ViroHandle; slot: FlexSlot };

export function ViroFlexView(props: Props) {
  const scene = useViroScene();
  // A nested FlexView is sized by the layout that placed it, as on native.
  const outerSlot = useViroFlexSlot();
  const width = outerSlot?.width ?? props.style?.width ?? props.width ?? 1;
  const height = outerSlot?.height ?? props.style?.height ?? props.height ?? 1;
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

  // ─── Layout ──────────────────────────────────────────────────────────────
  const childArray = useMemo(
    () => React.Children.toArray(props.children).filter(React.isValidElement),
    [props.children],
  );
  const childStyles = useMemo<FlexStyle[]>(
    () =>
      childArray.map((child) => {
        const p = (child as React.ReactElement).props as Record<string, unknown>;
        // A child's own width/height props are its intrinsic size, and a layout
        // that ignored them would collapse an image to nothing; the style wins
        // where it names the same thing, as it does in a stylesheet.
        const intrinsic: Record<string, unknown> = {};
        if (typeof p.width === "number") {
          intrinsic.width = p.width * FLEX_POINTS_PER_METER;
        }
        if (typeof p.height === "number") {
          intrinsic.height = p.height * FLEX_POINTS_PER_METER;
        }
        return { ...intrinsic, ...((p.style as Record<string, unknown>) ?? {}) };
      }),
    [childArray],
  );

  const layoutKey = JSON.stringify([childStyles, props.style ?? null, width, height]);

  // Measured and given nodes during render, not in an effect, for the reason
  // useViroNode creates its own node in a lazy initializer: React runs a child's
  // effects before its parent's, so a slot that only existed by effect time
  // would mount every child under the container first and move it a render
  // later — which for an image or a model is a second load, not a reparent.
  const layoutRef = useRef<{ key: string; slots: ChildSlot[] }>({ key: "", slots: [] });
  if (layoutRef.current.key !== layoutKey) {
    const widthPoints = width * FLEX_POINTS_PER_METER;
    const heightPoints = height * FLEX_POINTS_PER_METER;
    const rects = measureFlexChildren(props.style, childStyles, width, height);
    layoutRef.current = {
      key: layoutKey,
      slots: rects.map((rect) => ({
        node: scene.createNode(),
        slot: rectToSlot(rect, widthPoints, heightPoints),
      })),
    };
  }
  const slots = layoutRef.current.slots;

  useEffect(() => {
    if (!container) return;
    // Captured here rather than read in the cleanup: by the time a cleanup runs,
    // the render that changed the layout has already replaced the ref, and the
    // nodes to tear down are this effect's own.
    const attached = layoutRef.current.slots;
    for (const { node, slot } of attached) {
      scene.setNodePosition(node, slot.position[0], slot.position[1], slot.position[2]);
      scene.addChildNode(container, node);
    }
    return () => {
      for (const { node } of attached) {
        scene.removeNodeFromParent(node);
        scene.destroyNode(node);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container, layoutKey]);

  // Nothing measured — no document, or a container with no size — so the
  // children keep the transforms they were written with rather than all
  // stacking at the container's origin.
  if (slots.length !== childArray.length) {
    return (
      <ViroParentNodeContext.Provider value={container}>
        {props.children}
      </ViroParentNodeContext.Provider>
    );
  }

  return (
    <>
      {childArray.map((child, i) => (
        <ViroParentNodeContext.Provider key={i} value={slots[i]!.node}>
          <ViroFlexSlotContext.Provider value={slots[i]!.slot}>
            {child}
          </ViroFlexSlotContext.Provider>
        </ViroParentNodeContext.Provider>
      ))}
    </>
  );
}
