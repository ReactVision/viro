import * as React from "react";
import { Platform } from "react-native";
import { Viro3DObject } from "../../Viro3DObject";
import { ViroImage } from "../../ViroImage";
import { ViroText } from "../../ViroText";
import { ViroVideo } from "../../ViroVideo";
import { StudioAnimation, StudioAsset, StudioSceneMeta, ViroAnimationProp } from "../types";
import { executeFunctionWithRelations } from "./sceneNavigationHandler";
import { parseMaterialConfig, studioMaterialName } from "./materialConfig";
import { DragConfiguration } from "./dragConfiguration";
import { buildViroPhysicsBody, parsePhysicsBodyConfig } from "./physicsConfig";

type SceneNavigator = any;

export type NodeConfig = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  dragType?: "FixedDistance" | "FixedDistanceOrigin" | "FixedToWorld" | "FixedToPlane";
  dragPlane?: { planePoint: [number, number, number]; planeNormal: [number, number, number]; maxDistance: number };
  physicsBody?: Record<string, unknown>;
  viroTag?: string;
  onClick?: () => void;
  animation?: ViroAnimationProp;
};

/**
 * Derives the transform config for an asset.
 * Clamps Z to -2 for non-trigger assets to guarantee visibility.
 */
export function createNodeConfig(
  asset: StudioAsset,
  sceneNavigator: SceneNavigator | undefined,
  animations: StudioAnimation[],
  scene: StudioSceneMeta | null,
  onAnimationTrigger?: (targetAssetId: string, animKey: string) => void,
  animationStates?: Record<string, ViroAnimationProp>
): NodeConfig {
  const hasTriggerImage = !!asset.trigger_image_url;

  let posZ = asset.position_z ?? -2;
  if (!hasTriggerImage && posZ > -0.5) {
    console.warn(
      `[Studio/NodeFactory] Asset "${asset.name}" Z=${posZ} too close, clamping to -2`
    );
    posZ = -2;
  }

  const position: [number, number, number] = [
    asset.position_x ?? 0,
    asset.position_y ?? 0,
    posZ,
  ];

  // Apply trigger image orientation offset to rotation Z
  let rotationZ = asset.rotation_z ?? 0;
  if (hasTriggerImage && asset.trigger_image_orientation) {
    const offsets: Record<string, number> = {
      Left: -90,
      Right: 90,
      Down: 180,
      Up: 0,
    };
    rotationZ += offsets[asset.trigger_image_orientation] ?? 0;
  }

  const rotation: [number, number, number] = [
    asset.rotation_x ?? 0,
    asset.rotation_y ?? 0,
    rotationZ,
  ];

  let scaleValue = asset.scale ?? 1;
  if (scaleValue < 0.01) scaleValue = 0.1;
  if (scaleValue > 10) scaleValue = 2;
  const scale: [number, number, number] = [scaleValue, scaleValue, scaleValue];

  const dragType = DragConfiguration.getDragType(asset, scene);

  let dragPlane: NodeConfig["dragPlane"];
  if (dragType === "FixedToPlane") {
    dragPlane = DragConfiguration.getDragPlane(
      scene?.plane_direction ?? "Horizontal",
      position,
    );
  }

  const parsedPhysics = parsePhysicsBodyConfig(asset.physics_config);
  const physicsBody = parsedPhysics ? buildViroPhysicsBody(parsedPhysics) : undefined;
  const viroTag = parsedPhysics ? asset.id : undefined;

  const onClick = createOnClickHandler(
    asset,
    sceneNavigator,
    animations,
    onAnimationTrigger
  );

  const animation = animationStates?.[asset.id];

  return { position, rotation, scale, dragType, dragPlane, physicsBody, viroTag, onClick, animation };
}

function createOnClickHandler(
  asset: StudioAsset,
  sceneNavigator: SceneNavigator | undefined,
  animations: StudioAnimation[],
  onAnimationTrigger?: (targetAssetId: string, animKey: string) => void
): (() => void) | undefined {
  const fn = asset.scene_function;
  if (!fn) return undefined;

  if (fn.function_type === "NAVIGATION" && !fn.scene_navigation?.navigate_to) {
    console.warn(`[Studio] Asset "${asset.name}" has NAVIGATION but no target scene`);
    return undefined;
  }
  if (fn.function_type === "ALERT" && !fn.scene_alert) {
    console.warn(`[Studio] Asset "${asset.name}" has ALERT but no alert data`);
    return undefined;
  }
  if (fn.function_type === "ANIMATION" && !fn.scene_animation) {
    console.warn(`[Studio] Asset "${asset.name}" has ANIMATION but no animation data`);
    return undefined;
  }

  return () =>
    executeFunctionWithRelations(fn, sceneNavigator, animations, onAnimationTrigger);
}

/** Resolves asset type from asset_type_name. */
function resolveType(
  asset: StudioAsset
): "3D-MODEL" | "TEXT" | "IMAGE" | "VIDEO" | null {
  return asset.asset_type_name ?? null;
}

/** Infers 3D model format from file extension. */
function inferModelType(url: string): "GLB" | "GLTF" | "OBJ" | "VRX" {
  const ext = url.toLowerCase().split(".").pop();
  if (ext === "gltf") return "GLTF";
  if (ext === "obj") return "OBJ";
  if (ext === "vrx") return "VRX";
  return "GLB";
}

function create3DObject(
  asset: StudioAsset,
  config: NodeConfig,
  onAssetLoaded?: (id: string) => void
): React.ReactElement | null {
  if (!asset.file_url) {
    console.warn(`[Studio] 3D model "${asset.name}" has no file_url`);
    return null;
  }

  const modelType = inferModelType(asset.file_url);

  // Android: slightly reduce scale for stability
  const scale =
    Platform.OS === "android"
      ? ([
          config.scale[0] * 0.8,
          config.scale[1] * 0.8,
          config.scale[2] * 0.8,
        ] as [number, number, number])
      : config.scale;

  const hasMaterialConfig = parseMaterialConfig(asset.material_config) !== null;
  const shaderOverrides = hasMaterialConfig ? [studioMaterialName(asset.id)] : undefined;

  return (
    <Viro3DObject
      key={asset.id}
      source={{ uri: asset.file_url }}
      position={config.position}
      rotation={config.rotation}
      scale={scale}
      type={modelType}
      dragType={config.dragType}
      dragPlane={config.dragPlane}
      animation={config.animation as any}
      onClick={config.onClick}
      renderingOrder={Platform.OS === "android" ? 1 : 0}
      onLoadEnd={() => onAssetLoaded?.(asset.id)}
      onError={(e) =>
        console.error(`[Studio] 3D model "${asset.name}" error:`, e)
      }
      {...(shaderOverrides ? { shaderOverrides } : {})}
      {...(config.physicsBody ? { physicsBody: config.physicsBody as any, viroTag: config.viroTag } : {})}
    />
  );
}

function createImage(
  asset: StudioAsset,
  config: NodeConfig,
  onAssetLoaded?: (id: string) => void
): React.ReactElement | null {
  if (!asset.file_url) {
    console.warn(`[Studio] Image "${asset.name}" has no file_url`);
    return null;
  }

  return (
    <ViroImage
      key={asset.id}
      source={{ uri: asset.file_url }}
      position={config.position}
      rotation={config.rotation}
      scale={config.scale}
      dragType={config.dragType}
      animation={config.animation as any}
      onClick={config.onClick}
      onLoadEnd={() => onAssetLoaded?.(asset.id)}
      onError={(e) =>
        console.error(`[Studio] Image "${asset.name}" error:`, e)
      }
    />
  );
}

function createText(
  asset: StudioAsset,
  config: NodeConfig
): React.ReactElement {
  return (
    <ViroText
      key={asset.id}
      text={asset.name ?? ""}
      position={config.position}
      rotation={config.rotation}
      scale={config.scale}
      dragType={config.dragType}
      animation={config.animation as any}
      onClick={config.onClick}
      style={{
        fontFamily: "Arial",
        fontSize: 20,
        color: "#FFFFFF",
        textAlign: "center",
      }}
    />
  );
}

function createVideo(
  asset: StudioAsset,
  config: NodeConfig
): React.ReactElement | null {
  if (!asset.file_url) {
    console.warn(`[Studio] Video "${asset.name}" has no file_url`);
    return null;
  }

  return (
    <ViroVideo
      key={asset.id}
      source={{ uri: asset.file_url }}
      position={config.position}
      rotation={config.rotation}
      scale={config.scale}
      dragType={config.dragType}
      animation={config.animation as any}
      onClick={config.onClick}
      loop={true}
      muted={false}
      onError={(e) =>
        console.error(`[Studio] Video "${asset.name}" error:`, e)
      }
    />
  );
}

/**
 * Creates the appropriate Viro component for a StudioAsset.
 */
export function createNode(
  asset: StudioAsset,
  sceneNavigator: SceneNavigator | undefined,
  animations: StudioAnimation[],
  scene: StudioSceneMeta | null,
  onAnimationTrigger?: (targetAssetId: string, animKey: string) => void,
  animationStates?: Record<string, ViroAnimationProp>,
  onAssetLoaded?: (id: string) => void
): React.ReactElement | null {
  const type = resolveType(asset);
  const config = createNodeConfig(
    asset,
    sceneNavigator,
    animations,
    scene,
    onAnimationTrigger,
    animationStates
  );

  switch (type) {
    case "3D-MODEL":
      return create3DObject(asset, config, onAssetLoaded);
    case "IMAGE":
      return createImage(asset, config, onAssetLoaded);
    case "TEXT":
      return createText(asset, config);
    case "VIDEO":
      return createVideo(asset, config);
    default:
      console.warn(`[Studio] Unknown asset type "${type}" for "${asset.name}"`);
      return null;
  }
}
