/**
 * Web implementation of ViroPolygon — a filled polygon from `vertices` (2D
 * [x, y] points in the polygon's local plane; z is 0), with `holes` cut out of
 * it and `uvCoordinates` ([u0, v0, u1, v1]) mapped across its bounds. A renderer
 * without them (1.2.0) draws the outline alone with the whole texture.
 */
import * as React from "react";
import { useMemo } from "react";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { ViroParentNodeContext } from "./Web/ViroWebContext";

type Point2 = [number, number];

type Props = ViroWebNodeProps & {
  vertices: Point2[];
  holes?: Point2[][];
  uvCoordinates?: [number, number, number, number];
  /** Draw only the shadows that fall on it (a shadow-catching floor). */
  arShadowReceiver?: boolean;
  children?: React.ReactNode;
  [key: string]: any;
};

const WHOLE_TEXTURE: [number, number, number, number] = [0, 0, 1, 1];

function flatten(points: Point2[]): number[] {
  const flat: number[] = [];
  for (const p of points) {
    flat.push(p[0], p[1], 0);
  }
  return flat;
}

export function ViroPolygon(props: Props) {
  const vertices = props.vertices ?? [];
  const holes = props.holes ?? [];
  const uv = props.uvCoordinates?.length === 4 ? props.uvCoordinates : WHOLE_TEXTURE;
  const key = useMemo(
    () => [vertices, ...holes].map((path) => flatten(path).join(",")).join("|") + `|${uv.join(",")}`,
    [vertices, holes, uv],
  );

  const node = useViroNode(
    props,
    (scene) =>
      (typeof scene.createPolygonEx === "function" &&
        scene.createPolygonEx(flatten(vertices), holes.map(flatten), uv)) ||
      scene.createPolygon(flatten(vertices)),
    true,
    key,
  );

  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
