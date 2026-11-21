/**
 * Web implementation of ViroQuad — a node with a flat quad geometry (same
 * underlying surface as ViroSurface), rebuilt when its size or
 * `uvCoordinates` change, as native's setters do.
 */
import * as React from "react";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { useViroFlexSlot } from "./Web/ViroFlexSlotContext";
import { ViroParentNodeContext } from "./Web/ViroWebContext";

type Props = ViroWebNodeProps & {
  width?: number;
  height?: number;
  /** [u0, v0, u1, v1], the part of the texture the quad shows. */
  uvCoordinates?: number[];
  /** Draw only the shadows that fall on it (a shadow-catching floor). */
  arShadowReceiver?: boolean;
  children?: React.ReactNode;
  [key: string]: any;
};

export function ViroQuad(props: Props) {
  // Inside a ViroFlexView the layout decides the size, as it does natively.
  const slot = useViroFlexSlot();
  const width = slot?.width ?? props.width ?? 1;
  const height = slot?.height ?? props.height ?? 1;
  const uv = props.uvCoordinates?.length === 4 ? props.uvCoordinates : [0, 0, 1, 1];
  const node = useViroNode(
    props,
    (scene) => scene.createSurfaceUV(width, height, uv[0], uv[1], uv[2], uv[3]),
    true,
    `${width}x${height}|${uv.join(",")}`,
  );
  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
