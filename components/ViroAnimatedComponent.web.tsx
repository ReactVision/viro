/**
 * Web implementation of ViroAnimatedComponent (deprecated). Injects its
 * `animation` into its single child via the child's `animation` prop — the
 * modern per-component animation path. Prefer setting `animation` directly on
 * the component.
 */
import * as React from "react";

type Props = {
  animation: string;
  delay?: number;
  loop?: boolean;
  run?: boolean;
  onStart?: () => void;
  onFinish?: () => void;
  children?: React.ReactNode;
  [key: string]: any;
};

export function ViroAnimatedComponent(props: Props) {
  const child = React.Children.only(props.children) as React.ReactElement<any>;
  return React.cloneElement(child, {
    animation: {
      name: props.animation,
      run: props.run !== false,
      loop: props.loop ?? false,
      delay: props.delay,
      onStart: props.onStart,
      onFinish: props.onFinish,
    },
  });
}
