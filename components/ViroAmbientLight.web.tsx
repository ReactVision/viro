/** Web implementation of ViroAmbientLight. */
import { ViroLightType } from "@reactvision/viro-web-renderer";
import { useViroLight, type ViroWebLightProps } from "./Web/useViroLight";

export function ViroAmbientLight(props: ViroWebLightProps & { [key: string]: any }) {
  useViroLight(ViroLightType.Ambient, props);
  return null;
}
