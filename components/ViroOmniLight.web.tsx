/** Web implementation of ViroOmniLight. */
import { ViroLightType } from "@reactvision/viro-web-renderer";
import { useViroLight, type ViroWebLightProps } from "./Web/useViroLight";

export function ViroOmniLight(props: ViroWebLightProps & { [key: string]: any }) {
  useViroLight(ViroLightType.Omni, props);
  return null;
}
