/**
 * Web implementation of ViroGeometry — a custom mesh from `vertices`,
 * `normals`, `texcoords` and `triangleIndices`. Indices are triples [a, b, c].
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
  triangleIndices?: P3[];
  children?: React.ReactNode;
  [key: string]: any;
};

const flat3 = (pts?: P3[]): number[] => (pts ?? []).flatMap((p) => [p[0], p[1], p[2]]);
const flat2 = (pts?: P2[]): number[] => (pts ?? []).flatMap((p) => [p[0], p[1]]);

export function ViroGeometry(props: Props) {
  const vertices = useMemo(() => flat3(props.vertices), [props.vertices]);
  const normals = useMemo(() => flat3(props.normals), [props.normals]);
  const texcoords = useMemo(() => flat2(props.texcoords), [props.texcoords]);
  const indices = useMemo(() => flat3(props.triangleIndices), [props.triangleIndices]);
  const key = useMemo(
    () => `${vertices.length}:${normals.length}:${texcoords.length}:${indices.length}:${indices.join(",")}`,
    [vertices, normals, texcoords, indices],
  );

  const node = useViroNode(
    props,
    (scene) => scene.createGeometry(vertices, normals, texcoords, indices),
    true,
    key,
  );

  return (
    <ViroParentNodeContext.Provider value={node}>
      {props.children}
    </ViroParentNodeContext.Provider>
  );
}
