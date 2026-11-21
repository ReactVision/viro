/**
 * Web implementation of ViroSphere — a node with sphere geometry, rebuilt when
 * the radius, a segment count or facesOutward changes. A renderer without
 * segment counts (1.2.0) draws native's default 20x20 outward sphere.
 */
import * as React from "react";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { ViroParentNodeContext } from "./Web/ViroWebContext";

type Props = ViroWebNodeProps & {
  radius?: number;
  widthSegmentCount?: number;
  heightSegmentCount?: number;
  facesOutward?: boolean;
  children?: React.ReactNode;
  [key: string]: any;
};

export function ViroSphere(props: Props) {
  const radius = props.radius ?? 1;
  // VRTSphere's defaults.
  const widthSegments = props.widthSegmentCount ?? 20;
  const heightSegments = props.heightSegmentCount ?? 20;
  const facesOutward = props.facesOutward ?? true;
  const node = useViroNode(
    props,
    (scene) =>
      (typeof scene.createSphereEx === "function" &&
        scene.createSphereEx(radius, widthSegments, heightSegments, facesOutward)) ||
      scene.createSphere(radius),
    true,
    `${radius}|${widthSegments}|${heightSegments}|${facesOutward}`,
  );
  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
