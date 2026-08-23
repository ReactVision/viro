/**
 * Web implementation of ViroPolygon — a filled polygon from `vertices` (2D
 * [x, y] points in the polygon's local plane; z is 0). Holes are a follow-up.
 */
import * as React from "react";
import { useMemo } from "react";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { ViroParentNodeContext } from "./Web/ViroWebContext";

type Point2 = [number, number];

type Props = ViroWebNodeProps & {
  vertices: Point2[];
  holes?: Point2[][];
  children?: React.ReactNode;
  [key: string]: any;
};

function flatten(points: Point2[]): number[] {
  const flat: number[] = [];
  for (const p of points) {
    flat.push(p[0], p[1], 0);
  }
  return flat;
}

export function ViroPolygon(props: Props) {
  const vertices = props.vertices ?? [];
  const key = useMemo(() => flatten(vertices).join(","), [vertices]);

  const node = useViroNode(props, (scene) => scene.createPolygon(flatten(vertices)), true, key);

  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
