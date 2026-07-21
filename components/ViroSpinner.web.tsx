/**
 * Web implementation of ViroSpinner — two layered spinner images rotating in
 * opposite directions (matches native's look). `type` ("Dark"/"Light") picks the
 * bundled asset variant; a custom `source`/`sourceReverse` overrides it.
 *
 * Asset note: the built-in spinner PNGs are `require()`d (native parity); this
 * resolves under Metro/webpack (react-native-web). A custom `source` avoids any
 * bundler-specific asset handling.
 */
import * as React from "react";
import { ViroNode } from "./ViroNode.web";
import { ViroImage } from "./ViroImage.web";
import { ViroAnimations } from "./Animation/ViroAnimations.web";
import type { ViroWebNodeProps } from "./Web/useViroNode";

const ViroSpinner_1 = require("./Resources/viro_spinner_1.png");
const ViroSpinner_1a = require("./Resources/viro_spinner_1a.png");
const ViroSpinner_1_w = require("./Resources/viro_spinner_1_w.png");
const ViroSpinner_1a_w = require("./Resources/viro_spinner_1a_w.png");

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
