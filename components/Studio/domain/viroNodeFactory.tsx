import * as React from "react";
import { Platform } from "react-native";
import { Viro3DObject } from "../../Viro3DObject";
import { ViroImage } from "../../ViroImage";
import { ViroText } from "../../ViroText";
import { ViroVideo } from "../../ViroVideo";
import {
  StudioAnimation,
  StudioAsset,
  StudioSceneMeta,
  ViroAnimationProp,
} from "../types";
import {
  executeFunctionWithRelations,
  SequenceRuntimeContext,
} from "./sceneNavigationHandler";
import {
  extractPlaceholders,
  interpolateDisplayTemplate,
} from "./apiRequestHelpers";
import { parseMaterialConfig, studioMaterialName } from "./materialConfig";
import { DragConfiguration } from "./dragConfiguration";
import { buildViroPhysicsBody, parsePhysicsBodyConfig } from "./physicsConfig";
import { StudioVariableStore } from "./variableStore";
import { StudioVisibilityStore } from "./visibilityStore";

type SceneNavigator = any;

export type NodeConfig = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  dragType?:
    | "FixedDistance"
    | "FixedDistanceOrigin"
    | "FixedToWorld"
    | "FixedToPlane";
  dragPlane?: {
    planePoint: [number, number, number];
    planeNormal: [number, number, number];
    maxDistance: number;
  };
  physicsBody?: Record<string, unknown>;
  viroTag?: string;
  onClick?: () => void;
  animation?: ViroAnimationProp;
};

/** Clamps Z to -2 for non-trigger assets to guarantee visibility. */
export function createNodeConfig(
  asset: StudioAsset,
  sceneNavigator: SceneNavigator | undefined,
  animations: StudioAnimation[],
  scene: StudioSceneMeta | null,
  onAnimationTrigger?: (targetAssetId: string, animKey: string) => void,
  animationStates?: Record<string, ViroAnimationProp>,
  onSceneChange?: (sceneId: string, sceneName: string) => void,
  runtimeCtx?: SequenceRuntimeContext
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
      position
    );
  }

  const parsedPhysics = parsePhysicsBodyConfig(asset.physics_config);
  const physicsBody = parsedPhysics
    ? buildViroPhysicsBody(parsedPhysics)
    : undefined;
  const viroTag = parsedPhysics ? asset.id : undefined;

  const onClick = createOnClickHandler(
    asset,
    sceneNavigator,
    animations,
    onAnimationTrigger,
    onSceneChange,
    runtimeCtx
  );

  const animation = animationStates?.[asset.id];

  return {
    position,
    rotation,
    scale,
    dragType,
    dragPlane,
    physicsBody,
    viroTag,
    onClick,
    animation,
  };
}

function createOnClickHandler(
  asset: StudioAsset,
  sceneNavigator: SceneNavigator | undefined,
  animations: StudioAnimation[],
  onAnimationTrigger?: (targetAssetId: string, animKey: string) => void,
  onSceneChange?: (sceneId: string, sceneName: string) => void,
  runtimeCtx?: SequenceRuntimeContext
): (() => void) | undefined {
  const fn = asset.scene_function;
  if (!fn) return undefined;

  if (fn.function_type === "NAVIGATION" && !fn.scene_navigation?.navigate_to) {
    console.warn(
      `[Studio] Asset "${asset.name}" has NAVIGATION but no target scene`
    );
    return undefined;
  }
  if (fn.function_type === "ALERT" && !fn.scene_alert) {
    console.warn(`[Studio] Asset "${asset.name}" has ALERT but no alert data`);
    return undefined;
  }
  if (fn.function_type === "ANIMATION" && !fn.scene_animation) {
    console.warn(
      `[Studio] Asset "${asset.name}" has ANIMATION but no animation data`
    );
    return undefined;
  }

  return () =>
    executeFunctionWithRelations(
      fn,
      sceneNavigator,
      animations,
      onAnimationTrigger,
      0,
      onSceneChange,
      runtimeCtx
    );
}

function resolveType(
  asset: StudioAsset
): "3D-MODEL" | "TEXT" | "IMAGE" | "VIDEO" | null {
  return asset.asset_type_name ?? null;
}

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
  onAssetLoaded?: (id: string) => void,
  onCollision?: (
    viroTag: string,
    collidedPoint: [number, number, number],
    collidedNormal: [number, number, number]
  ) => void
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
  const shaderOverrides = hasMaterialConfig
    ? [studioMaterialName(asset.id)]
    : undefined;

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
      // Viro derives native canDrag from `onDrag != undefined`; without this prop
      // the drag recognizer is never attached, even when dragType is set.
      {...(config.dragType ? { onDrag: () => {} } : {})}
      {...(shaderOverrides ? { shaderOverrides } : {})}
      {...(config.physicsBody
        ? { physicsBody: config.physicsBody as any, viroTag: config.viroTag }
        : {})}
      {...(onCollision ? { onCollision: onCollision as any } : {})}
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
      onError={(e) => console.error(`[Studio] Image "${asset.name}" error:`, e)}
      {...(config.dragType ? { onDrag: () => {} } : {})}
    />
  );
}

/**
 * TEXT node whose content is a {{variable}} template (the asset name). It
 * re-interpolates and repaints whenever a referenced variable changes (and only
 * subscribes when the template actually has placeholders). Resolution is
 * fail-soft: unknown names stay literal.
 */
const VariableText: React.FC<{
  asset: StudioAsset;
  config: NodeConfig;
  store?: StudioVariableStore;
  // Injected by VisibleNode via cloneElement; TEXT is the only node type that
  // is a component wrapper, so it forwards visibility to its ViroText.
  visible?: boolean;
}> = ({ asset, config, store, visible }) => {
  const template = asset.name ?? "";
  const compute = () =>
    store
      ? interpolateDisplayTemplate(template, (n) => store.get(n))
      : template;
  const [text, setText] = React.useState(compute);

  React.useEffect(() => {
    if (!store || extractPlaceholders(template).length === 0) return;
    // Resync any write that landed between first render and subscribe.
    setText(compute());
    return store.subscribe(() => setText(compute()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, template]);

  return (
    <ViroText
      text={text}
      position={config.position}
      rotation={config.rotation}
      scale={config.scale}
      dragType={config.dragType}
      animation={config.animation as any}
      onClick={config.onClick}
      {...(visible === undefined ? {} : { visible })}
      style={{
        fontFamily: "Arial",
        fontSize: 20,
        color: "#FFFFFF",
        textAlign: "center",
      }}
      {...(config.dragType ? { onDrag: () => {} } : {})}
    />
  );
};

/**
 * Wraps a created node and drives its `visible` prop from the per-scene
 * visibility store, subscribing to its own asset so a Set Visibility action
 * repaints only this node. Without a store, the node stays visible.
 */
const VisibleNode: React.FC<{
  assetId: string;
  store?: StudioVisibilityStore;
  // Props typed loosely so cloneElement can inject `visible` (all Viro node
  // types accept it via ViroCommonProps).
  children: React.ReactElement<any>;
}> = ({ assetId, store, children }) => {
  const [visible, setVisible] = React.useState(
    () => store?.isVisible(assetId) ?? true
  );

  React.useEffect(() => {
    if (!store) return;
    // Resync any write that landed between first render and subscribe.
    setVisible(store.isVisible(assetId));
    return store.subscribe(assetId, () => setVisible(store.isVisible(assetId)));
  }, [store, assetId]);

  return React.cloneElement(children, { visible });
};

function createText(
  asset: StudioAsset,
  config: NodeConfig,
  store?: StudioVariableStore
): React.ReactElement {
  return (
    <VariableText key={asset.id} asset={asset} config={config} store={store} />
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
      onError={(e) => console.error(`[Studio] Video "${asset.name}" error:`, e)}
      {...(config.dragType ? { onDrag: () => {} } : {})}
    />
  );
}

export function createNode(
  asset: StudioAsset,
  sceneNavigator: SceneNavigator | undefined,
  animations: StudioAnimation[],
  scene: StudioSceneMeta | null,
  onAnimationTrigger?: (targetAssetId: string, animKey: string) => void,
  animationStates?: Record<string, ViroAnimationProp>,
  onAssetLoaded?: (id: string) => void,
  onCollision?: (
    viroTag: string,
    collidedPoint: [number, number, number],
    collidedNormal: [number, number, number]
  ) => void,
  onSceneChange?: (sceneId: string, sceneName: string) => void,
  runtimeCtx?: SequenceRuntimeContext
): React.ReactElement | null {
  const type = resolveType(asset);
  const config = createNodeConfig(
    asset,
    sceneNavigator,
    animations,
    scene,
    onAnimationTrigger,
    animationStates,
    onSceneChange,
    runtimeCtx
  );

  let node: React.ReactElement | null;
  switch (type) {
    case "3D-MODEL":
      node = create3DObject(asset, config, onAssetLoaded, onCollision);
      break;
    case "IMAGE":
      node = createImage(asset, config, onAssetLoaded);
      break;
    case "TEXT":
      node = createText(asset, config, runtimeCtx?.variableStore);
      break;
    case "VIDEO":
      node = createVideo(asset, config);
      break;
    default:
      console.warn(`[Studio] Unknown asset type "${type}" for "${asset.name}"`);
      return null;
  }

  if (!node) return null;

  // Drive show/hide/toggle from the visibility store (Set Visibility actions);
  // seeded from the asset's author-time hidden_on_load default.
  return (
    <VisibleNode
      key={asset.id}
      assetId={asset.id}
      store={runtimeCtx?.visibilityStore}
    >
      {node}
    </VisibleNode>
  );
}
