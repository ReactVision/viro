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
import { DragConfiguration, type DragSurface } from "./dragConfiguration";
import {
  buildViroPhysicsBody,
  isPhysicsWorldEnabled,
  parsePhysicsBodyConfig,
  shouldUseKinematicPhysicsDrag,
} from "./physicsConfig";
import { StudioVariableStore } from "./variableStore";
import { StudioVisibilityStore } from "./visibilityStore";
import { StudioPlacementStore, isTapToPlaceAsset } from "./placementStore";
import { studioAssetPosition } from "./assetPosition";
import type { StudioDragStore } from "./dragStore";
import type { Vec3 } from "../colocation/frameMath";

// Android (phones and Quest) loads fonts from /system/fonts alone, which has no
// Arial. Naming the system sans-serif renders what the failed Arial lookup fell
// back to anyway, without the lookup and its warning on every text.
export const STUDIO_TEXT_FONT_FAMILY =
  Platform.OS === "android" ? "sans-serif" : "Arial";

type SceneNavigator = any;
/** A drag reports its world position; the scene tracks and shares it. */
type DragNotify = (assetId: string, worldPosition?: Vec3) => void;

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
  /** The body while another device drags it: kinematic, so it follows their writes. */
  lockedPhysicsBody?: Record<string, unknown>;
  /** Authored velocity, sent once on mount rather than on the body. */
  viroTag?: string;
  onClick?: () => void;
  // On Gaze (headset eye-gaze). Setting it enables the node's native canHover.
  onGaze?: (
    isHovering: boolean,
    position: [number, number, number],
    source: number
  ) => void;
  animation?: ViroAnimationProp;
  /** Web only: the renderer handle for this node, as it is created and as it goes. */
  onNodeHandle?: (handle: number) => void;
  /** Told when this asset's model, image or video fails to load. */
  onAssetError?: StudioAssetErrorHandler;
};

/** An asset that failed to load, and why. */
export type StudioAssetErrorHandler = (asset: StudioAsset, error: Error) => void;

/**
 * The asset's onError: logged as before, and handed to the host when it asked.
 * Before this the console was the only place a failure went, and a host's error
 * tracking hooks window.onerror and unhandledrejection, neither of which a
 * caught load error ever reaches.
 */
function assetErrorHandler(asset: StudioAsset, config: NodeConfig, kind: string) {
  return (e: unknown) => {
    console.error(`[Studio] ${kind} "${asset.name}" error:`, e);
    if (!config.onAssetError) return;
    const error =
      e instanceof Error
        ? e
        : new Error(
            typeof e === "object" && e && "nativeEvent" in e
              ? JSON.stringify((e as { nativeEvent: unknown }).nativeEvent)
              : String(e)
          );
    config.onAssetError(asset, error);
  };
}

export function createNodeConfig(
  asset: StudioAsset,
  sceneNavigator: SceneNavigator | undefined,
  animations: StudioAnimation[],
  scene: StudioSceneMeta | null,
  onAnimationTrigger?: (targetAssetId: string, animKey: string) => void,
  animationStates?: Record<string, ViroAnimationProp>,
  isDragActive?: (assetId: string) => boolean,
  onSceneChange?: (sceneId: string, sceneName: string) => void,
  runtimeCtx?: SequenceRuntimeContext,
  // The detected plane this asset is anchored to, once the session has found
  // one. Only the assets under the plane wrapper have it.
  dragSurface?: DragSurface | null
): NodeConfig {
  const position = studioAssetPosition(asset);

  // A trigger image's orientation describes the uploaded FILE, not the surface
  // it is printed on and not a rotation for the content: it says where the top
  // of that file is, so a sideways or upside-down file is still recognised.
  // virocore acts on it by correcting the pixels before the tracker sees them
  // (VROARSessionARCore rotates the grayscale buffer, VROARImageTargetiOS passes
  // a CGImagePropertyOrientation to ARReferenceImage), so the anchor frame comes
  // back the same whatever it is set to. This used to add Left -90, Right 90 and
  // Down 180 to rotation Z, which nothing cancelled: content on any non-Up
  // marker was drawn turned, upside down in the Down case.
  const rotation: [number, number, number] = [
    asset.rotation_x ?? 0,
    asset.rotation_y ?? 0,
    asset.rotation_z ?? 0,
  ];

  // Zero, negative and non-finite scales are degenerate transforms rather than
  // small ones, so they fall back to 1. Everything else passes through, large
  // values included: scale doubles as compensation for a model's own units, so a
  // mesh authored in centimetres legitimately needs about 100. This replaced a
  // pair of rules that substituted 0.1 below 0.01 and 2 above 10, which rendered
  // an asset authored at 13 more than six times too small with no way to tell.
  // Editors that author these scenes apply the same rule, and hold their own
  // copy of it since this package does not depend on them.
  let scaleValue = asset.scale ?? 1;
  if (!Number.isFinite(scaleValue) || scaleValue <= 0) scaleValue = 1;
  const scale: [number, number, number] = [scaleValue, scaleValue, scaleValue];

  const dragType = DragConfiguration.getDragType(asset, scene);

  let dragPlane: NodeConfig["dragPlane"];
  if (dragType === "FixedToPlane") {
    dragPlane = DragConfiguration.getDragPlane(
      scene?.plane_direction ?? "Horizontal",
      position,
      dragSurface
    );
  }

  // Both the body and its collision tag hang off the scene's physics switch
  // (isPhysicsWorldEnabled), which is what the Studio UI, its editor preview and
  // the apply_physics tool all treat as the switch.
  const parsedPhysics = isPhysicsWorldEnabled(scene)
    ? parsePhysicsBodyConfig(asset.physics_config)
    : null;
  const dragActive = isDragActive?.(asset.id) ?? false;
  const physicsBody = parsedPhysics
    ? buildViroPhysicsBody(parsedPhysics, {
        kinematicDragOverride:
          dragActive && shouldUseKinematicPhysicsDrag(asset, parsedPhysics),
        scale: scaleValue,
      })
    : undefined;
  const viroTag = parsedPhysics ? asset.id : undefined;
  const lockedPhysicsBody =
    parsedPhysics &&
    dragType &&
    shouldUseKinematicPhysicsDrag(asset, parsedPhysics)
      ? buildViroPhysicsBody(parsedPhysics, {
          kinematicDragOverride: true,
          scale: scaleValue,
        })
      : undefined;

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
    ...(lockedPhysicsBody ? { lockedPhysicsBody } : {}),
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
  notifyPhysicsDrag?: DragNotify,
  onCollision?: (
    viroTag: string,
    collidedPoint: [number, number, number],
    collidedNormal: [number, number, number]
  ) => void,
  nodeRef?: (ref: unknown) => void
): React.ReactElement | null {
  if (!asset.file_url) {
    console.warn(`[Studio] 3D model "${asset.name}" has no file_url`);
    return null;
  }

  const modelType = inferModelType(asset.file_url);

  const hasMaterialConfig = parseMaterialConfig(asset.material_config) !== null;
  const shaderOverrides = hasMaterialConfig
    ? [studioMaterialName(asset.id)]
    : undefined;

  return (
    <Viro3DObject
      key={asset.id}
      {...(nodeRef ? { ref: nodeRef as any } : {})}
      source={{ uri: asset.file_url }}
      position={config.position}
      rotation={config.rotation}
      scale={config.scale}
      type={modelType}
      dragType={config.dragType}
      dragPlane={config.dragPlane}
      animation={config.animation as any}
      onClick={config.onClick}
      {...(config.onNodeHandle ? { onNodeHandle: config.onNodeHandle } : {})}
      onLoadEnd={() => onAssetLoaded?.(asset.id)}
      onError={assetErrorHandler(asset, config, "3D model")}
      // Viro derives native canDrag from `onDrag != undefined`; without this prop
      // the drag recognizer is never attached, even when dragType is set.
      {...(config.dragType
        ? { onDrag: (to: Vec3) => notifyPhysicsDrag?.(asset.id, to) }
        : {})}
      {...(shaderOverrides ? { shaderOverrides } : {})}
      {...(config.physicsBody
        ? { physicsBody: config.physicsBody as any, viroTag: config.viroTag }
        : {})}
      {...(onCollision ? { onCollision: onCollision as any } : {})}
      {...(config.onGaze ? { onGaze: config.onGaze as any } : {})}
    />
  );
}

function createImage(
  asset: StudioAsset,
  config: NodeConfig,
  onAssetLoaded?: (id: string) => void,
  notifyPhysicsDrag?: DragNotify,
  onCollision?: (
    viroTag: string,
    collidedPoint: [number, number, number],
    collidedNormal: [number, number, number]
  ) => void,
  nodeRef?: (ref: unknown) => void
): React.ReactElement | null {
  if (!asset.file_url) {
    console.warn(`[Studio] Image "${asset.name}" has no file_url`);
    return null;
  }

  return (
    <ViroImage
      key={asset.id}
      {...(nodeRef ? { ref: nodeRef as any } : {})}
      source={{ uri: asset.file_url }}
      // No width or height props, so the bridges derive the height from the
      // image's own aspect on load, but only build the quad from it under
      // ScaleToFill; the default StretchToFill keeps the 1x1 quad and squashes
      // the picture. The crop this mode also selects needs explicit size props,
      // so the UVs stay 0 to 1.
      resizeMode="ScaleToFill"
      position={config.position}
      rotation={config.rotation}
      scale={config.scale}
      dragType={config.dragType}
      animation={config.animation as any}
      onClick={config.onClick}
      {...(config.onNodeHandle ? { onNodeHandle: config.onNodeHandle } : {})}
      onLoadEnd={() => onAssetLoaded?.(asset.id)}
      onError={assetErrorHandler(asset, config, "Image")}
      {...(config.dragType
        ? { onDrag: (to: Vec3) => notifyPhysicsDrag?.(asset.id, to) }
        : {})}
      {...(config.physicsBody
        ? { physicsBody: config.physicsBody as any, viroTag: config.viroTag }
        : {})}
      {...(onCollision ? { onCollision: onCollision as any } : {})}
      {...(config.onGaze ? { onGaze: config.onGaze as any } : {})}
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
  notifyPhysicsDrag?: DragNotify;
  onCollision?: (
    viroTag: string,
    collidedPoint: [number, number, number],
    collidedNormal: [number, number, number]
  ) => void;
  nodeRef?: (ref: unknown) => void;
  // Injected via cloneElement; TEXT is the only node type that is a component
  // wrapper, so it must forward these to its ViroText: `visible` from
  // VisibleNode, `position`/`rotation` from PlaceableNode (tap-relative placement).
  visible?: boolean;
  position?: [number, number, number];
  rotation?: [number, number, number];
  // From DragNode while another device holds the asset.
  dragLocked?: boolean;
  physicsBody?: Record<string, unknown>;
}> = ({
  asset,
  config,
  store,
  notifyPhysicsDrag,
  onCollision,
  nodeRef,
  visible,
  position,
  rotation,
  dragLocked,
  physicsBody,
}) => {
  const body = physicsBody ?? config.physicsBody;
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
      {...(nodeRef ? { ref: nodeRef as any } : {})}
      text={text}
      position={position ?? config.position}
      rotation={rotation ?? config.rotation}
      scale={config.scale}
      dragType={config.dragType}
      animation={config.animation as any}
      onClick={config.onClick}
      {...(config.onNodeHandle ? { onNodeHandle: config.onNodeHandle } : {})}
      {...(visible === undefined ? {} : { visible })}
      style={{
        fontFamily: STUDIO_TEXT_FONT_FAMILY,
        fontSize: 20,
        color: "#FFFFFF",
        textAlign: "center",
        // Centred on the node rather than hung from the top of its box, so the
        // authored position is where the text is at any scale.
        textAlignVertical: "center",
      }}
      {...(config.dragType && !dragLocked
        ? { onDrag: (to: Vec3) => notifyPhysicsDrag?.(asset.id, to) }
        : {})}
      {...(body ? { physicsBody: body as any, viroTag: config.viroTag } : {})}
      {...(onCollision ? { onCollision: onCollision as any } : {})}
      {...(config.onGaze ? { onGaze: config.onGaze as any } : {})}
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

/**
 * Gates a tap-to-place node: renders nothing until the end user places the
 * asset, then mounts it at the tap point with the author position AND rotation
 * applied relative to where the user was facing when they tapped (see
 * StudioPlacementStore.resolvePlacedPosition / resolvePlacedRotation), and hands
 * off to VisibleNode so Set Visibility still applies. Never inside a plane
 * wrapper: the position is in the frame the node renders in, world coordinates
 * at the scene root, or scene-origin coordinates while shared.
 */
const PlaceableNode: React.FC<{
  assetId: string;
  store: StudioPlacementStore;
  authorPosition: [number, number, number];
  authorRotation: [number, number, number];
  visibilityStore?: StudioVisibilityStore;
  children: React.ReactElement<any>;
}> = ({
  assetId,
  store,
  authorPosition,
  authorRotation,
  visibilityStore,
  children,
}) => {
  // The position rather than a placed flag: a shared session can move an asset
  // that is already placed, and only a new position re-renders it.
  const [placedAt, setPlacedAt] = React.useState(() =>
    store.getPosition(assetId)
  );

  React.useEffect(() => {
    setPlacedAt(store.getPosition(assetId));
    return store.subscribe(assetId, () =>
      setPlacedAt(store.getPosition(assetId))
    );
  }, [store, assetId]);

  if (!placedAt) return null;

  const position =
    store.resolvePlacedPosition(assetId, authorPosition) ?? authorPosition;
  const rotation =
    store.resolvePlacedRotation(assetId, authorRotation) ?? authorRotation;

  return (
    <VisibleNode assetId={assetId} store={visibilityStore}>
      {React.cloneElement(children, { position, rotation })}
    </VisibleNode>
  );
};

/** Far below what can be seen, and enough to make a prop a change. */
const DRAG_REPAINT_NUDGE_M = 1e-6;

/**
 * The props a DragNode hands its node. Injected ones (from VisibleNode and
 * PlaceableNode) pass through, another device's drag position wins over them,
 * and while that device holds the asset it cannot be dragged here.
 */
export function dragNodeProps(
  drag: { position?: Vec3; locked: boolean; revision: number },
  injected: Record<string, unknown>,
  childPosition: Vec3 | undefined,
  isText: boolean,
  lockedPhysicsBody?: Record<string, unknown>
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(injected)) {
    if (value !== undefined) props[key] = value;
  }
  const base =
    drag.position ?? (props.position as Vec3 | undefined) ?? childPosition;
  // A prop equal to the last one is never sent to native, and a refused drag
  // moved the node there natively, so a repaint has to differ from it.
  if (base) {
    props.position =
      drag.revision % 2 === 1
        ? [base[0], base[1] + DRAG_REPAINT_NUDGE_M, base[2]]
        : base;
  }
  if (drag.locked) {
    // canDrag follows onDrag (see create3DObject).
    if (isText) props.dragLocked = true;
    else props.onDrag = undefined;
    if (lockedPhysicsBody) props.physicsBody = lockedPhysicsBody;
  }
  return props;
}

/**
 * Moves a draggable node where another device in a shared session dragged it,
 * subscribing to its own asset so a remote drag repaints this node alone.
 */
const DragNode: React.FC<{
  assetId: string;
  store: StudioDragStore;
  lockedPhysicsBody?: Record<string, unknown>;
  children: React.ReactElement<any>;
  visible?: boolean;
  position?: Vec3;
  rotation?: Vec3;
}> = ({ assetId, store, lockedPhysicsBody, children, ...injected }) => {
  const read = () => ({
    position: store.getPosition(assetId),
    locked: store.isLocked(assetId),
    revision: store.revision(assetId),
  });
  const [drag, setDrag] = React.useState(read);

  React.useEffect(() => {
    setDrag(read());
    return store.subscribe(assetId, () => setDrag(read()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, assetId]);

  return React.cloneElement(
    children,
    dragNodeProps(
      drag,
      injected,
      children.props.position ?? children.props.config?.position,
      children.type === VariableText,
      lockedPhysicsBody
    )
  );
};

function createText(
  asset: StudioAsset,
  config: NodeConfig,
  notifyPhysicsDrag?: DragNotify,
  store?: StudioVariableStore,
  onCollision?: (
    viroTag: string,
    collidedPoint: [number, number, number],
    collidedNormal: [number, number, number]
  ) => void,
  nodeRef?: (ref: unknown) => void
): React.ReactElement {
  return (
    <VariableText
      key={asset.id}
      asset={asset}
      config={config}
      store={store}
      notifyPhysicsDrag={notifyPhysicsDrag}
      onCollision={onCollision}
      nodeRef={nodeRef}
    />
  );
}

function createVideo(
  asset: StudioAsset,
  config: NodeConfig,
  notifyPhysicsDrag?: DragNotify,
  onCollision?: (
    viroTag: string,
    collidedPoint: [number, number, number],
    collidedNormal: [number, number, number]
  ) => void,
  nodeRef?: (ref: unknown) => void
): React.ReactElement | null {
  if (!asset.file_url) {
    console.warn(`[Studio] Video "${asset.name}" has no file_url`);
    return null;
  }

  return (
    <ViroVideo
      key={asset.id}
      {...(nodeRef ? { ref: nodeRef as any } : {})}
      source={{ uri: asset.file_url }}
      position={config.position}
      rotation={config.rotation}
      scale={config.scale}
      dragType={config.dragType}
      animation={config.animation as any}
      onClick={config.onClick}
      {...(config.onNodeHandle ? { onNodeHandle: config.onNodeHandle } : {})}
      loop={true}
      muted={false}
      onError={assetErrorHandler(asset, config, "Video")}
      {...(config.dragType
        ? { onDrag: (to: Vec3) => notifyPhysicsDrag?.(asset.id, to) }
        : {})}
      {...(config.physicsBody
        ? { physicsBody: config.physicsBody as any, viroTag: config.viroTag }
        : {})}
      {...(onCollision ? { onCollision: onCollision as any } : {})}
      {...(config.onGaze ? { onGaze: config.onGaze as any } : {})}
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
  isDragActive?: (assetId: string) => boolean,
  notifyPhysicsDrag?: DragNotify,
  onSceneChange?: (sceneId: string, sceneName: string) => void,
  runtimeCtx?: SequenceRuntimeContext,
  // When set (proximity-target assets), captures the live Viro node so the host
  // can read its world transform for the distance check.
  registerProximityTarget?: (assetId: string, ref: unknown) => void,
  // When set (gaze-target assets on a headset), the node's native onGaze handler.
  onGaze?: (
    isHovering: boolean,
    position: [number, number, number],
    source: number
  ) => void,
  // See createNodeConfig.
  dragSurface?: DragSurface | null,
  // The web host's half of registerProximityTarget. Native reads a node's
  // transform off its component ref; web reads it off a renderer handle, since
  // these components' props carry an index signature that makes them unsafe
  // behind forwardRef (see useViroNode's onNodeHandle). Only one is ever set.
  registerProximityNode?: (assetId: string, handle: number) => void,
  onAssetError?: StudioAssetErrorHandler
): React.ReactElement | null {
  const type = resolveType(asset);
  const config = createNodeConfig(
    asset,
    sceneNavigator,
    animations,
    scene,
    onAnimationTrigger,
    animationStates,
    isDragActive,
    onSceneChange,
    runtimeCtx,
    dragSurface
  );
  config.onGaze = onGaze;
  config.onAssetError = onAssetError;

  const proximityRef = registerProximityTarget
    ? (ref: unknown) => registerProximityTarget(asset.id, ref)
    : undefined;
  if (registerProximityNode) {
    config.onNodeHandle = (handle: number) =>
      registerProximityNode(asset.id, handle);
  }

  const buildNode = (
    nodeRef?: (ref: unknown) => void
  ): React.ReactElement | null => {
    switch (type) {
      case "3D-MODEL":
        // NOTE: notifyPhysicsDrag and onCollision are distinct wirings — keep
        // both; a drag-only merge here once silently killed collisions.
        return create3DObject(
          asset,
          config,
          onAssetLoaded,
          notifyPhysicsDrag,
          onCollision,
          nodeRef
        );
      case "IMAGE":
        return createImage(
          asset,
          config,
          onAssetLoaded,
          notifyPhysicsDrag,
          onCollision,
          nodeRef
        );
      case "TEXT":
        return createText(
          asset,
          config,
          notifyPhysicsDrag,
          runtimeCtx?.variableStore,
          onCollision,
          nodeRef
        );
      case "VIDEO":
        return createVideo(
          asset,
          config,
          notifyPhysicsDrag,
          onCollision,
          nodeRef
        );
      default:
        console.warn(
          `[Studio] Unknown asset type "${type}" for "${asset.name}"`
        );
        return null;
    }
  };

  const built = buildNode(proximityRef);

  if (!built) return null;

  // Marker content sits on each device's own image, so its drags stay local.
  const dragStore = runtimeCtx?.dragStore;
  const node =
    dragStore && config.dragType && !asset.trigger_image_url ? (
      <DragNode
        assetId={asset.id}
        store={dragStore}
        lockedPhysicsBody={config.lockedPhysicsBody}
      >
        {built}
      </DragNode>
    ) : (
      built
    );

  // Tap-to-place assets are withheld until placed; PlaceableNode then mounts the
  // node at the tap point with the author position and rotation applied relative
  // to the user's facing, and wraps it in VisibleNode itself. A marker asset is
  // never gated this way, whatever the flag says (isTapToPlaceAsset).
  if (isTapToPlaceAsset(asset) && runtimeCtx?.placementStore) {
    return (
      <PlaceableNode
        key={asset.id}
        assetId={asset.id}
        store={runtimeCtx.placementStore}
        authorPosition={config.position}
        authorRotation={config.rotation}
        visibilityStore={runtimeCtx?.visibilityStore}
      >
        {node}
      </PlaceableNode>
    );
  }

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
