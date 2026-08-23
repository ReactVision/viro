/** Web implementation of ViroSpotLight. */
import { ViroLightType } from "@reactvision/viro-web-renderer";
import { useViroLight, type ViroWebLightProps } from "./Web/useViroLight";

export function ViroSpotLight(props: ViroWebLightProps & { [key: string]: any }) {
  useViroLight(ViroLightType.Spot, props);
  return null;
}
