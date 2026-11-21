/**
 * Web implementation of ViroGeometry — a custom mesh from `vertices`,
 * `normals`, `texcoords` and `triangleIndices`. Each `triangleIndices` entry is
 * a submesh, any number of triangles long, and takes the material at its index.
 */
import * as React from "react";
import { useMemo } from "react";
import { useViroNode, type ViroWebNodeProps } from "./Web/useViroNode";
import { ViroParentNodeContext } from "./Web/ViroWebContext";

type P3 = [number, number, number];
type P2 = [number, number];

type Props = ViroWebNodeProps & {
  vertices?: P3[];
  normals?: P3[];
  texcoords?: P2[];
  triangleIndices?: number[][];
  children?: React.ReactNode;
  [key: string]: any;
};

const flat3 = (pts?: P3[]): number[] => (pts ?? []).flatMap((p) => [p[0], p[1], p[2]]);
const flat2 = (pts?: P2[]): number[] => (pts ?? []).flatMap((p) => [p[0], p[1]]);

export function ViroGeometry(props: Props) {
  const vertices = useMemo(() => flat3(props.vertices), [props.vertices]);
  const normals = useMemo(() => flat3(props.normals), [props.normals]);
  const texcoords = useMemo(() => flat2(props.texcoords), [props.texcoords]);
  const submeshes = useMemo(() => (props.triangleIndices ?? []).map((s) => [...s]), [props.triangleIndices]);
  const key = useMemo(
    () => `${vertices.length}:${normals.length}:${texcoords.length}:${submeshes.map((s) => s.join(",")).join("|")}`,
    [vertices, normals, texcoords, submeshes],
  );

  // A renderer without submeshes (1.2.0) gets them as one, so the shape is
  // whole and the first material covers it.
  const node = useViroNode(
    props,
    (scene) =>
      (typeof scene.createGeometrySubmeshes === "function" &&
        scene.createGeometrySubmeshes(vertices, normals, texcoords, submeshes)) ||
      scene.createGeometry(vertices, normals, texcoords, submeshes.flat()),
    true,
    key,
  );

  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
