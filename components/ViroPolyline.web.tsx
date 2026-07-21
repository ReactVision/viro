/**
 * Web implementation of ViroPolyline — a line strip through `points` with a
 * given `thickness`. Points may be [x, y] (z defaults to 0) or [x, y, z].
 */
import * as React from "react";
import { useMemo } from "react";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { ViroParentNodeContext } from "./Web/ViroWebContext";

type Point = [number, number] | [number, number, number];

type Props = ViroWebNodeProps & {
  points?: Point[];
  thickness?: number;
  children?: React.ReactNode;
  [key: string]: any;
};

function flatten(points: Point[]): number[] {
  const flat: number[] = [];
  for (const p of points) {
    flat.push(p[0], p[1], p[2] ?? 0);
  }
  return flat;
}

export function ViroPolyline(props: Props) {
  const points = props.points ?? [];
  const thickness = props.thickness ?? 0.1;
  const key = useMemo(() => `${thickness}:${flatten(points).join(",")}`, [points, thickness]);

  const node = useViroNode(
    props,
    (scene) => scene.createPolyline(flatten(points), thickness),
    true,
    key,
  );

  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
