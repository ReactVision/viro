/**
 * Lifecycle hook for web light components. A light is a VROLight (not a node):
 * it's created via the C API, added to the enclosing node, updated as props
 * change, and removed on unmount.
 */
import { useState, useEffect } from "react";
import { ViroLightType, type ViroHandle } from "@reactvision/viro-web-renderer";
import { useViroScene, useViroParentNode } from "./ViroWebContext";
import { parseColorToRGBA } from "./viroColor";

export interface ViroWebLightProps {
  color?: string | number;
  intensity?: number;
  temperature?: number;
  direction?: [number, number, number];
  position?: [number, number, number];
  attenuationStartDistance?: number;
  attenuationEndDistance?: number;
  innerAngle?: number;
  outerAngle?: number;
  castsShadow?: boolean;
}

export function useViroLight(type: ViroLightType, props: ViroWebLightProps): ViroHandle {
  const scene = useViroScene();
  const parent = useViroParentNode();

  const [light] = useState<ViroHandle>(() => scene.createLight(type));

  useEffect(() => {
    scene.addLightToNode(parent, light);
    return () => {
      scene.removeLightFromNode(parent, light);
      scene.destroyLight(light);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    color,
    intensity,
    temperature,
    direction,
    position,
    attenuationStartDistance,
    attenuationEndDistance,
    innerAngle,
    outerAngle,
    castsShadow,
  } = props;
  const dirKey = direction ? direction.join(",") : "";
  const posKey = position ? position.join(",") : "";

  useEffect(() => {
    if (color !== undefined) {
      const [r, g, b] = parseColorToRGBA(color);
      scene.setLightColor(light, r, g, b);
    }
    if (intensity !== undefined) scene.setLightIntensity(light, intensity);
    if (temperature !== undefined) scene.setLightTemperature(light, temperature);
    if (direction) scene.setLightDirection(light, direction[0], direction[1], direction[2]);
    if (position) scene.setLightPosition(light, position[0], position[1], position[2]);
    if (attenuationStartDistance !== undefined && attenuationEndDistance !== undefined) {
      scene.setLightAttenuation(light, attenuationStartDistance, attenuationEndDistance);
    }
    if (innerAngle !== undefined && outerAngle !== undefined) {
      scene.setLightSpotAngles(light, innerAngle, outerAngle);
    }
    if (castsShadow !== undefined) scene.setLightCastsShadow(light, castsShadow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    light,
    color,
    intensity,
    temperature,
    dirKey,
    posKey,
    attenuationStartDistance,
    attenuationEndDistance,
    innerAngle,
    outerAngle,
    castsShadow,
  ]);

  return light;
}
