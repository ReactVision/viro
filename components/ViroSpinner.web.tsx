/**
 * Web implementation of ViroSpinner, two layered spinner images rotating in
 * opposite directions (matches native's look). `type` ("Dark"/"Light") picks the
 * bundled asset variant; a custom `source`/`sourceReverse` overrides it.
 *
 * The built-in images are data URIs rather than `require()`d PNGs, since not
 * every web bundler has `require` or an asset loader for PNGs.
 */
import * as React from "react";
import { ViroNode } from "./ViroNode.web";
import { ViroImage } from "./ViroImage.web";
import { ViroAnimations } from "./Animation/ViroAnimations.web";
import type { ViroWebNodeProps } from "./Web/useViroNode";
import {
  viroSpinner1 as ViroSpinner_1,
  viroSpinner1a as ViroSpinner_1a,
  viroSpinner1W as ViroSpinner_1_w,
  viroSpinner1aW as ViroSpinner_1a_w,
} from "./Web/viroSpinnerImages";

ViroAnimations.registerAnimations({
  _viroSpinnerClockwise: { duration: 1000, easing: "Linear", properties: { rotateZ: -360 } },
  _viroSpinnerCounter: { duration: 1000, easing: "Linear", properties: { rotateZ: 360 } },
});

type Props = ViroWebNodeProps & {
  type?: "Dark" | "Light" | "dark" | "light";
  source?: unknown;
  sourceReverse?: unknown;
  width?: number;
  height?: number;
  [key: string]: any;
};

export function ViroSpinner(props: Props) {
  const isLight = (props.type ?? "Dark").toUpperCase() === "LIGHT";
  const base = props.source ?? (isLight ? ViroSpinner_1_w : ViroSpinner_1);
  const overlay = props.sourceReverse ?? (isLight ? ViroSpinner_1a_w : ViroSpinner_1a);
  const width = props.width ?? 1;
  const height = props.height ?? 1;

  return (
    <ViroNode {...props}>
      <ViroImage
        source={base}
        width={width}
        height={height}
        animation={{ name: "_viroSpinnerClockwise", run: true, loop: true }}
      />
      <ViroImage
        source={overlay}
        width={width}
        height={height}
        position={[0, 0, 0.001]}
        animation={{ name: "_viroSpinnerCounter", run: true, loop: true }}
      />
    </ViroNode>
  );
}
