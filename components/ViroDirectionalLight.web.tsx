/** Web implementation of ViroDirectionalLight. */
import { ViroLightType } from "@reactvision/viro-web-renderer";
import { useViroLight, type ViroWebLightProps } from "./Web/useViroLight";

export function ViroDirectionalLight(props: ViroWebLightProps & { [key: string]: any }) {
  useViroLight(ViroLightType.Directional, props);
  return null;
}
