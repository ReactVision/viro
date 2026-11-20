/**
 * Shared lifecycle hook for web node components. Creates a native node (and
 * optional geometry) via the C API, parents it under the enclosing node, applies
 * transform/material props, and tears down on unmount.
 *
 * The node handle is created in a lazy useState initializer so it exists on the
 * first render — children read it from context and parent themselves correctly
 * even though React runs child effects before parent effects.
 */
import { useState, useEffect, useImperativeHandle, useRef, type Ref } from "react";
import {
  ViroBillboardAxis,
  ViroEventAction,
  ViroClickState,
  type ViroHandle,
  type ViroSceneApi,
} from "@reactvision/viro-web-renderer";
import { useViroScene, useViroParentNode, useViroRenderer } from "./ViroWebContext";
import {
  applyARShadow,
  applyRegistryMaterials,
  createMaterialFromRegistry,
  createOwnMaterial,
} from "./viroMaterialRegistry";
import { useViroAnimation, type ViroAnimationProp } from "./useViroAnimation";
import { applyPhysicsBody, offsetImpulse, type ViroPhysicsBodyProp } from "./viroPhysicsBody";
import { registerCollisionBody } from "./viroCollisions";
import { conjugateQuat, quatFromEulerDegrees, rotateByQuaternion } from "./viroMath";
import {
  cameraView,
  dragFollower,
  parentSpace,
  rayAt,
  releaseVelocity,
  screenPointOf,
  sub,
  type DragPlane,
  type Vec3,
} from "./viroDrag";
import { warnUnsupported } from "../Utilities/ViroUnsupported";

const DEG2RAD = Math.PI / 180;

/**
 * The billboard axis a `transformBehaviors` list asks for, or null for none.
 *
 * The three names native recognises and no more: its bridges compare against
 * "billboard", "billboardX" and "billboardY" and ignore anything else, so a
 * "billboardZ" invented here would work in a browser and nowhere else.
 *
 * Last one wins, because a node carries one constraint.
 */
function billboardAxis(behaviors: string): ViroBillboardAxis | null {
  let axis: ViroBillboardAxis | null = null;
  for (const raw of behaviors.split(",")) {
    switch (raw.trim().toLowerCase()) {
      case "billboard": axis = ViroBillboardAxis.All; break;
      case "billboardx": axis = ViroBillboardAxis.X; break;
      case "billboardy": axis = ViroBillboardAxis.Y; break;
    }
  }
  return axis;
}

type ViroPosition = [number, number, number];

/** What a ref to a node component reaches, as on native (ViroBase). */
export type ViroWebNodeHandle = {
  /** `position` is from the centre of mass, in world axes, as Bullet takes it. */
  applyImpulse(force: number[], position?: number[]): void;
  applyTorqueImpulse(torque: number[]): void;
  setVelocity(velocity: number[]): void;
  /** Last frame's world transform, rotation in degrees. */
  getTransformAsync(): Promise<{ position: ViroPosition; rotation: ViroPosition; scale: ViroPosition }>;
  getBoundingBoxAsync(): Promise<{
    boundingBox: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  }>;
  /** Native has this on Viro3DObject only; on the web any node answers. */
  getMorphTargets(): Promise<{ targets: string[] }>;
  /** Applies position, rotation, scale, opacity and visible until the props next change them. */
  setNativeProps(nativeProps: Partial<ViroWebNodeProps>): void;
};

type ViroFuseProp = (() => void) | ((source: number) => void) | { callback: (source: number) => void; timeToFuse?: number };

export interface ViroWebNodeProps {
  position?: [number, number, number];
  rotation?: [number, number, number]; // degrees, Viro convention
  scale?: [number, number, number];
  /** Node-local point the rotation turns about; [0,0,0] by default. */
  rotationPivot?: [number, number, number];
  /** Node-local point the scale grows from; [0,0,0] by default. */
  scalePivot?: [number, number, number];
  /** Hit test this node's triangles, subtree included, instead of its bounding box. */
  highAccuracyEvents?: boolean;
  /** Deprecated name for highAccuracyEvents. */
  highAccuracyGaze?: boolean;
  opacity?: number;
  visible?: boolean;
  /** Taps and hit tests pass through this node and its whole subtree, loaded model content included. */
  ignoreEventHandling?: boolean;
  materials?: string | string[];
  /** ViroQuad and ViroPolygon only, as natively. */
  arShadowReceiver?: boolean;
  // Registered material names merged onto whatever this node draws, subtree
  // included. The path a Studio `material_config` takes, and the only one that
  // reaches a loaded model — see the effect below.
  shaderOverrides?: string | string[];
  /**
   * This node's renderer handle as it is created, and 0 as it goes.
   *
   * How a host asks the renderer where a node actually is, since an authored
   * position is a world position only while nothing above the node moves — which
   * stops being true inside a plane wrapper or after a drag. A prop rather than
   * a ref because these components' props carry an `[key: string]: any` index
   * signature, and React's `PropsWithoutRef` resolves that to `Omit<P, "ref">`,
   * which drops every declared prop and would silently untype every caller.
   */
  onNodeHandle?: (handle: ViroHandle) => void;
  /** Drawn-last wins among equal-depth fragments. */
  renderingOrder?: number;
  /** "billboard" | "billboardX" | "billboardY", the three native accepts. */
  transformBehaviors?: string | string[];
  /** Masks against a light's influenceBitMask; both must intersect to light. */
  lightReceivingBitMask?: number;
  shadowCastingBitMask?: number;
  /** Rigid body, in the shape Studio's physicsConfig emits. */
  physicsBody?: ViroPhysicsBodyProp;
  /** Name a collision reports this node by. */
  viroTag?: string;
  /** Called with the other body's viroTag, the contact point and its normal. */
  onCollision?: (viroTag: string, collidedPoint: ViroPosition, collidedNormal: ViroPosition) => void;
  dragType?: "FixedDistance" | "FixedDistanceOrigin" | "FixedToWorld" | "FixedToPlane";
  dragPlane?: DragPlane;
  /** The node's new world position while it is dragged. */
  onDrag?: (dragToPos: ViroPosition, source: number) => void;
  /** The node's position in its parent, each time it has moved 1 cm (native's filter). */
  onTransformUpdate?: (position: ViroPosition) => void;
  /** React 19 passes a function component's ref as a prop. */
  ref?: Ref<ViroWebNodeHandle>;
  // Events (world-space position, input source id).
  onClick?: (position: ViroPosition, source: number) => void;
  onClickState?: (
    clickState: number,
    position: ViroPosition,
    source: number,
  ) => void;
  onHover?: (isHovering: boolean, position: ViroPosition, source: number) => void;
  onPinch?: (pinchState: number, scaleFactor: number, source: number) => void;
  /** rotationFactor in degrees, counterclockwise, as native reports it. */
  onRotate?: (rotateState: number, rotationFactor: number, source: number) => void;
  /** Fires once the screen centre has rested on the node for timeToFuse ms (default 2000). */
  onFuse?: ViroFuseProp;
  animation?: ViroAnimationProp;
}

/**
 * The nodes this hook made, by scene and handle, so a press is routed up the
 * tree as native routes it. The renderer hands a press only to the first node
 * with clicks enabled, and a node here enables them to be dragged too, so its
 * clicks go on to the nearest ancestor that takes them, and a press on a
 * clickable child drags the nearest ancestor with onDrag.
 */
type NodeEntry = { parent: ViroHandle; props(): ViroWebNodeProps; startDrag(hit: Vec3): void; endDrag(): void };
const nodeEntries = new WeakMap<ViroSceneApi, Map<ViroHandle, NodeEntry>>();

/** The nodes this hook has made in `scene`, with their parents and current props, for a host that inspects the scene. */
export function viroNodeEntries(scene: ViroSceneApi): ReadonlyMap<ViroHandle, { parent: ViroHandle; props(): ViroWebNodeProps }> {
  return nodeEntries.get(scene) ?? new Map();
}

/**
 * Turns a world point into `parent`'s local space, from the transforms of the
 * nodes this hook made above it. Taken once per drag: a node animated without
 * its props is read at its authored transform.
 */
function worldToLocalIn(scene: ViroSceneApi, parent: ViroHandle): ((world: Vec3) => Vec3) | null {
  const origin = scene.getNodeWorldPosition(parent);
  if (!origin) return null;
  const map = nodeEntries.get(scene);
  const ancestors: ViroWebNodeProps[] = [];
  for (let entry = map?.get(parent); entry; entry = map!.get(entry.parent)) ancestors.push(entry.props());
  return parentSpace(origin, ancestors);
}

// Native's kTransformDelegateDistanceFilter, in metres.
const TRANSFORM_DISTANCE_FILTER = 0.01;

/**
 * World to `parent`'s space from its last drawn transform, which follows
 * animations and physics; null before it is drawn or on a renderer without the read.
 */
function drawnParentSpace(scene: ViroSceneApi, parent: ViroHandle): ((world: Vec3) => Vec3) | null {
  if (typeof scene.getNodeWorldTransform !== "function") return null;
  const p = scene.getNodeWorldTransform(parent);
  // All zero before it is drawn; any zero is a flattened parent with no inverse.
  if (!p || p.scale.some((c) => c === 0)) return null;
  const inverse = conjugateQuat(quatFromEulerDegrees(p.rotation));
  return (world) => {
    const local = rotateByQuaternion(inverse, sub(world, p.position));
    return [local[0] / p.scale[0], local[1] / p.scale[1], local[2] / p.scale[2]];
  };
}

/** The node's last drawn position in its parent's space, or null before it has been drawn. */
function localPosition(scene: ViroSceneApi, node: ViroHandle, parent: ViroHandle): Vec3 | null {
  const t = scene.getNodeWorldTransform(node);
  if (!t || t.scale.every((c) => c === 0)) return null;
  const toLocal = drawnParentSpace(scene, parent);
  return toLocal ? toLocal(t.position) : t.position;
}

/** False while the node or any node above it is hidden, as native's shouldAppear. */
function effectivelyVisible(scene: ViroSceneApi, node: ViroHandle): boolean {
  const map = nodeEntries.get(scene);
  for (let entry = map?.get(node); entry; entry = map!.get(entry.parent)) {
    if (entry.props().visible === false) return false;
  }
  return true;
}

/** Scene roots with a scene's own handlers (useViroSceneEvents), where a routed event ends. */
const sceneRootEntries = new WeakMap<ViroSceneApi, Map<ViroHandle, NodeEntry>>();

function nearestNode(scene: ViroSceneApi, node: ViroHandle, wants: (p: ViroWebNodeProps) => boolean): NodeEntry | null {
  const map = nodeEntries.get(scene);
  let handle = node;
  let entry = map?.get(handle);
  while (entry) {
    if (wants(entry.props())) return entry;
    handle = entry.parent;
    entry = map!.get(handle);
  }
  const root = sceneRootEntries.get(scene)?.get(handle);
  return root && wants(root.props()) ? root : null;
}

type ViroSceneEventProps = Pick<ViroWebNodeProps, "onClick" | "onClickState" | "onHover" | "onPinch" | "onRotate" | "onFuse" | "onDrag">;

/**
 * A scene's own onClick, onClickState, onHover, onPinch, onRotate and onFuse.
 * Native gives them to the scene root, which virocore hands a hit on the
 * background and any event no node below it takes; a click a node took only
 * for its drag reaches them through nearestNode, as it bubbles on native.
 */
export function useViroSceneEvents(props: ViroSceneEventProps): void {
  const scene = useViroScene();
  const renderer = useViroRenderer();
  const root = useViroParentNode();
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    let map = sceneRootEntries.get(scene);
    if (!map) sceneRootEntries.set(scene, (map = new Map()));
    // No onDrag: the root does not move.
    map.set(root, { parent: 0, props: () => ({ ...propsRef.current, onDrag: undefined }), startDrag: () => {}, endDrag: () => {} });
    return () => {
      map.delete(root);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root]);

  const hasClick = !!(props.onClick || props.onClickState);
  const hasHover = !!props.onHover;
  const hasPinch = !!props.onPinch;
  const hasRotate = !!props.onRotate;
  const hasFuse = !!props.onFuse;
  useEffect(() => {
    if (!hasClick && !hasHover && !hasPinch && !hasRotate && !hasFuse) return;
    renderer.setNodeEventHandlers(root, {
      onClick: (clickState, source, position) => {
        const p = propsRef.current;
        p.onClickState?.(clickState, position, source);
        if (clickState === ViroClickState.Clicked) p.onClick?.(position, source);
      },
      onHover: (isHovering, source, position) => propsRef.current.onHover?.(isHovering, position, source),
      onPinch: (state, scale, source) => propsRef.current.onPinch?.(state, scale, source),
      onRotate: (state, radians, source) => propsRef.current.onRotate?.(state, radians / DEG2RAD, source),
      onFuse: (source) => {
        const fuse = propsRef.current.onFuse;
        if (typeof fuse === "function") fuse(source);
        else fuse?.callback?.(source);
      },
    });
    if (hasClick) scene.setNodeEventEnabled(root, ViroEventAction.Click, true);
    if (hasHover) scene.setNodeEventEnabled(root, ViroEventAction.Hover, true);
    if (hasPinch) scene.setNodeEventEnabled(root, 10, true);
    if (hasRotate) scene.setNodeEventEnabled(root, 11, true);
    if (hasFuse) scene.setNodeEventEnabled(root, 9, true);
    return () => {
      renderer.clearNodeEventHandlers(root);
      scene.setNodeEventEnabled(root, ViroEventAction.Click, false);
      scene.setNodeEventEnabled(root, ViroEventAction.Hover, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, hasClick, hasHover, hasPinch, hasRotate, hasFuse]);

  const hasDrag = !!props.onDrag;
  useEffect(() => {
    if (hasDrag) warnUnsupported("onDrag on ViroScene and ViroARScene", "the web");
  }, [hasDrag]);
}

export function useViroNode(
  props: ViroWebNodeProps,
  createGeometry?: (scene: ViroSceneApi) => ViroHandle,
  // False until a loaded model's subtree exists. Gates the two things that need
  // it: its embedded animations, and the shader-override merge. A node whose
  // geometry this hook builds is ready on mount, hence the default.
  contentReady: boolean = true,
  // When provided, the geometry is rebuilt whenever this key changes (a new
  // size, text that re-shapes). Without it the geometry is built once.
  geometryKey?: string | number,
  // Factory for the underlying node (default `createNode`). Override for special
  // node types, e.g. portal scenes (`createPortalScene`).
  createNodeFn?: (scene: ViroSceneApi) => ViroHandle,
  // A component's own ref methods, beside the node's (a video's seekToTime).
  // Read once per node, so they should reach changing state through refs.
  extraRefMethods?: Record<string, (...args: any[]) => unknown>,
  // False for a component that dresses its geometry with materials of its own
  // (an image, video or text): a color or material animation would replace them.
  materialAnimatable: boolean = true,
): ViroHandle {
  const scene = useViroScene();
  const renderer = useViroRenderer();
  const parent = useViroParentNode();

  const [node] = useState<ViroHandle>(() =>
    createNodeFn ? createNodeFn(scene) : scene.createNode(),
  );
  const geometryRef = useRef<ViroHandle>(0);
  // Read from a ref wherever an effect must not re-run when a callback's
  // identity changes; declared here because the mount effect already needs it.
  const propsRef = useRef(props);
  propsRef.current = props;
  // `visible` as a ref's setNativeProps last set it, until the prop next changes.
  const nativeVisibleRef = useRef<boolean | undefined>(undefined);
  // Whether the node's body is in the world (see the physics block); a drag
  // released while hidden leaves it out.
  const shownRef = useRef<boolean | null>(null);
  // Ends a drag in progress; `release` false skips letting a held body go.
  const endDragRef = useRef<((release?: boolean) => void) | null>(null);

  // Node lifecycle: attach to parent on mount; destroy node on unmount.
  useEffect(() => {
    scene.addChildNode(parent, node);
    propsRef.current.onNodeHandle?.(node);
    return () => {
      // Before the handle is destroyed, which ending the drag would otherwise reach.
      endDragRef.current?.(false);
      // Handed back before the handle is destroyed: a holder that reads it
      // afterwards is asking the renderer about freed memory.
      propsRef.current.onNodeHandle?.(0);
      scene.removeNodeFromParent(node);
      scene.destroyNode(node);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geometry lifecycle: (re)built on mount and whenever geometryKey changes.
  useEffect(() => {
    if (!createGeometry) return;
    const geo = createGeometry(scene);
    geometryRef.current = geo;
    scene.setNodeGeometry(node, geo);
    return () => {
      if (geometryRef.current === geo) geometryRef.current = 0;
      scene.destroyGeometry(geo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometryKey]);

  // Transform + visibility props.
  const [px, py, pz] = props.position ?? [0, 0, 0];
  const [rx, ry, rz] = props.rotation ?? [0, 0, 0];
  const [sx, sy, sz] = props.scale ?? [1, 1, 1];
  const opacity = props.opacity ?? 1;
  const visible = props.visible ?? true;
  const selectable = !props.ignoreEventHandling;

  // Each on its own, as native sends only what changed: re-sending the authored
  // position whenever opacity or visibility changes would undo a drag.
  useEffect(() => {
    scene.setNodePosition(node, px, py, pz);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, px, py, pz]);
  useEffect(() => {
    scene.setNodeRotation(node, rx * DEG2RAD, ry * DEG2RAD, rz * DEG2RAD);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, rx, ry, rz]);
  useEffect(() => {
    scene.setNodeScale(node, sx, sy, sz);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, sx, sy, sz]);
  useEffect(() => {
    scene.setNodeOpacity(node, opacity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, opacity]);
  useEffect(() => {
    nativeVisibleRef.current = undefined;
    scene.setNodeVisible(node, visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, visible]);
  useEffect(() => {
    // Renderers before 1.2.0 have no setNodeSelectable; calling it would throw for every node.
    if (typeof scene.setNodeSelectable !== "function") {
      if (!selectable) warnUnsupported("ignoreEventHandling with viro-web-renderer before 1.2.0", "the web");
      return;
    }
    scene.setNodeSelectable(node, selectable);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, selectable]);
  useNodePivot(scene, node, props.rotationPivot, "rotation");
  useNodePivot(scene, node, props.scalePivot, "scale");
  const highAccuracy = !!(props.highAccuracyEvents ?? props.highAccuracyGaze);
  const highAccuracySentRef = useRef(false);
  useEffect(() => {
    // false is the engine's default, so nothing is sent until the prop is first set.
    if (!highAccuracy && !highAccuracySentRef.current) return;
    if (!scene.setNodeHighAccuracyEvents?.(node, highAccuracy)) {
      if (highAccuracy) warnUnsupported("highAccuracyEvents with this build of the web renderer", "the web");
      return;
    }
    highAccuracySentRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, highAccuracy]);

  // Dragging, which native enables with onDrag (dragType defaults to
  // FixedDistance). The renderer reports a press on the node; the drag is
  // followed here, on rays from the camera's published view (viroDrag.ts),
  // every frame as native does, so carrying the phone carries the node. A
  // dynamic body is held kinematic while dragged, as virocore's setKinematicDrag
  // does, and let go with the velocity of its last ~80 ms, so it can be thrown.
  const bodyKeyRef = useRef("");
  const heldRef = useRef(false);
  const startDrag = (hit: Vec3) => {
    const p = propsRef.current;
    const view = cameraView(scene);
    if (!p.onDrag || endDragRef.current) return;
    if (!view) {
      warnUnsupported("Dragging nodes (onDrag) under a ViroCamera or ViroOrbitCamera", "the web");
      return;
    }
    const nodeStart = scene.getNodeWorldPosition(node);
    const toLocal = worldToLocalIn(scene, parent);
    if (!nodeStart || !toLocal) return;
    // A press virocore rerouted to a recently hovered node arrives at the origin;
    // native grabs such a node at its own position.
    const grab: Vec3 = hit.every((c) => c === 0) ? nodeStart : hit;
    const cameraAt = [...view.position] as Vec3;
    const toGrab = sub(grab, cameraAt);
    const len = Math.hypot(...toGrab) || 1;
    const dragType = p.dragType ?? "FixedDistance";
    const follow = dragFollower(dragType, p.dragPlane, {
      ray: { origin: cameraAt, dir: [toGrab[0] / len, toGrab[1] / len, toGrab[2] / len] },
      hit: grab,
      node: nodeStart,
    });
    if (!follow) {
      warnUnsupported(`dragType "${dragType}"`, "the web");
      return;
    }
    const body = p.physicsBody;
    const thrown = !!body && body.enabled !== false && (body.type ?? "").toLowerCase() === "dynamic";
    heldRef.current = thrown;
    if (thrown) applyPhysicsBody(scene, node, { ...body, type: "Kinematic", instantVelocity: undefined }, bodyKeyRef.current);
    const samples: { t: number; p: Vec3 }[] = [{ t: performance.now(), p: nodeStart }];
    let pointer = screenPointOf(view, grab);
    let notified = nodeStart;
    let frame = 0;
    const step = () => {
      frame = requestAnimationFrame(step);
      if (!pointer) return;
      const to = follow(rayAt(view, pointer.x, pointer.y));
      if (!to) return;
      // Each frame, since the parent may itself be moving; the authored props
      // stand in on a renderer that cannot read its drawn transform.
      const local = (drawnParentSpace(scene, parent) ?? toLocal)(to);
      scene.setNodePosition(node, local[0], local[1], local[2]);
      samples.push({ t: performance.now(), p: to });
      if (samples.length > 12) samples.shift();
      // Native's ON_DRAG_DISTANCE_THRESHOLD.
      if (Math.hypot(...sub(to, notified)) < 0.01) return;
      notified = to;
      propsRef.current.onDrag?.(to, 0);
    };
    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => end();
    const end = (release = true) => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      endDragRef.current = null;
      heldRef.current = false;
      if (!release) return;
      // Measured to the release, not the last move: a pointer held still fires none.
      const last = samples[samples.length - 1]!;
      samples.push({ t: performance.now(), p: last.p });
      const now = propsRef.current.physicsBody;
      if (thrown && now && shownRef.current === true) {
        applyPhysicsBody(scene, node, { ...now, instantVelocity: undefined }, bodyKeyRef.current);
        scene.setPhysicsVelocity(node, releaseVelocity(samples), false);
      }
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    frame = requestAnimationFrame(step);
    endDragRef.current = end;
  };

  useEffect(() => {
    let map = nodeEntries.get(scene);
    if (!map) nodeEntries.set(scene, (map = new Map()));
    map.set(node, {
      parent,
      props: () =>
        nativeVisibleRef.current === undefined ? propsRef.current : { ...propsRef.current, visible: nativeVisibleRef.current },
      startDrag,
      endDrag: () => endDragRef.current?.(),
    });
    return () => {
      map.delete(node);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node]);

  // Events: register handlers once, reading the latest props off the ref above,
  // so a changed callback identity does not re-subscribe.
  const hasClick = !!(props.onClick || props.onClickState || props.onDrag);
  const hasHover = !!props.onHover;
  const hasPinch = !!props.onPinch;
  const hasRotate = !!props.onRotate;
  const hasFuse = !!props.onFuse;
  const timeToFuse = typeof props.onFuse === "object" ? props.onFuse.timeToFuse : undefined;
  useEffect(() => {
    if (!hasClick && !hasHover && !hasPinch && !hasRotate && !hasFuse) return;
    renderer.setNodeEventHandlers(node, {
      onClick: (clickState, source, position) => {
        if (clickState === ViroClickState.ClickDown) {
          nearestNode(scene, node, (p) => !!p.onDrag)?.startDrag(position);
        } else if (clickState === ViroClickState.ClickUp) {
          // A release has already ended the drag; this is for a press a second
          // finger cancelled, which the drag's pointer listeners never see.
          nearestNode(scene, node, (p) => !!p.onDrag)?.endDrag();
        }
        const p = nearestNode(scene, node, (q) => !!(q.onClick || q.onClickState))?.props();
        p?.onClickState?.(clickState, position, source);
        if (clickState === ViroClickState.Clicked) {
          p?.onClick?.(position, source);
        }
      },
      onHover: (isHovering, source, position) => {
        propsRef.current.onHover?.(isHovering, position, source);
      },
      onPinch: (state, scale, source) => propsRef.current.onPinch?.(state, scale, source),
      onRotate: (state, radians, source) => propsRef.current.onRotate?.(state, radians / DEG2RAD, source),
      onFuse: (source) => {
        const fuse = propsRef.current.onFuse;
        if (typeof fuse === "function") fuse(source);
        else fuse?.callback?.(source);
      },
    });
    if (hasClick) scene.setNodeEventEnabled(node, ViroEventAction.Click, true);
    if (hasHover) scene.setNodeEventEnabled(node, ViroEventAction.Hover, true);
    if (hasPinch || hasRotate || hasFuse) {
      // Literal ids, not ViroEventAction's members: renderer 1.1.1 has none of them.
      if (scene.supportsGestures !== true) {
        warnUnsupported("onPinch, onRotate and onFuse", "this build of the web renderer", "Update @reactvision/viro-web-renderer.");
      }
      if (hasPinch) scene.setNodeEventEnabled(node, 10, true);
      if (hasRotate) scene.setNodeEventEnabled(node, 11, true);
      if (hasFuse) scene.setNodeEventEnabled(node, 9, true);
    }
    return () => renderer.clearNodeEventHandlers(node);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, hasClick, hasHover, hasPinch, hasRotate, hasFuse]);
  useEffect(() => {
    if (hasFuse && typeof scene.setNodeTimeToFuse === "function") scene.setNodeTimeToFuse(node, timeToFuse ?? 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, hasFuse, timeToFuse]);

  // Materials, again on each rebuild, since a rebuilt geometry starts from its
  // own materials.
  const materialsKey = Array.isArray(props.materials)
    ? props.materials.join(",")
    : props.materials ?? "";
  // A color or material animation changes the node's own copy, made on first
  // use: named materials are shared, so changing one would recolour every node
  // that uses the name. Dropped when the materials change, as native's
  // materials prop replaces an animated material.
  const ownMaterialRef = useRef<{ geo: ViroHandle; material: ViroHandle } | null>(null);
  const dropOwnMaterial = () => {
    if (ownMaterialRef.current) scene.destroyMaterial(ownMaterialRef.current.material);
    ownMaterialRef.current = null;
  };
  const ownMaterial = (): ViroHandle => {
    const geo = geometryRef.current;
    if (!materialAnimatable) {
      warnUnsupported("color and material animations on images, videos and text", "the web");
      return 0;
    }
    if (!geo) return 0;
    if (ownMaterialRef.current?.geo === geo) return ownMaterialRef.current.material;
    dropOwnMaterial();
    const material = createOwnMaterial(scene, materialsKey.split(",")[0] || undefined);
    scene.setGeometryMaterial(geo, material);
    ownMaterialRef.current = { geo, material };
    return material;
  };
  useEffect(() => dropOwnMaterial, []);
  useEffect(() => {
    dropOwnMaterial();
    const geo = geometryRef.current;
    if (!geo || !materialsKey) return;
    applyRegistryMaterials(scene, geo, materialsKey.split(","));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, materialsKey, geometryKey]);

  // arShadowReceiver (ViroQuad, ViroPolygon): the node's own copy, after the
  // effect above has put the shared one back, since the modifiers would
  // otherwise reach every node using the name.
  const arShadowReceiver = props.arShadowReceiver === true;
  const wasShadowReceiver = useRef(false);
  useEffect(() => {
    if (arShadowReceiver) {
      const material = ownMaterial();
      if (material) applyARShadow(scene, material);
    } else if (wasShadowReceiver.current) {
      dropOwnMaterial();
      const geo = geometryRef.current;
      const restored = !!geo && !!materialsKey && applyRegistryMaterials(scene, geo, materialsKey.split(","));
      if (!restored) ownMaterial();
    }
    wasShadowReceiver.current = arShadowReceiver;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, materialsKey, geometryKey, arShadowReceiver]);

  // Shader overrides. Separate from `materials` above because that one needs the
  // geometry handle this hook created, and a loaded model has none: its geometry
  // belongs to the loader and hangs off child nodes. So a Studio material_config,
  // which viroNodeFactory sends as `shaderOverrides`, only ever reaches a model
  // through here.
  //
  // Gated on `contentReady` so a model is merged after it loads rather than
  // against an empty subtree.
  const overrideKey = Array.isArray(props.shaderOverrides)
    ? props.shaderOverrides.join(",")
    : props.shaderOverrides ?? "";
  useEffect(() => {
    if (!overrideKey || !contentReady) return;
    // Each name re-merges from the materials the node drew before any override
    // and replaces them, so with several the last one wins, as on native. The
    // model keeps whatever the material does not set.
    for (const name of overrideKey.split(",")) {
      const material = createMaterialFromRegistry(scene, name);
      if (material) scene.applyShaderOverride(node, material);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, overrideKey, contentReady]);

  // Rendering order, light masks and billboarding. All four are native node
  // props that had no web path at all: a scene lighting one object with one
  // light, or turning a label to face the user, did neither here.
  const renderingOrder = props.renderingOrder;
  const lightReceivingBitMask = props.lightReceivingBitMask;
  const shadowCastingBitMask = props.shadowCastingBitMask;
  useEffect(() => {
    if (renderingOrder !== undefined) scene.setNodeRenderingOrder(node, renderingOrder);
    // Recursive: a loaded model's geometry is on child nodes, so a mask set on
    // the handle alone would miss everything that actually draws.
    if (lightReceivingBitMask !== undefined) {
      scene.setNodeLightReceivingBitMask(node, lightReceivingBitMask, true);
    }
    if (shadowCastingBitMask !== undefined) {
      scene.setNodeShadowCastingBitMask(node, shadowCastingBitMask, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, renderingOrder, lightReceivingBitMask, shadowCastingBitMask]);

  const behaviorsKey = Array.isArray(props.transformBehaviors)
    ? props.transformBehaviors.join(",")
    : props.transformBehaviors ?? "";
  useEffect(() => {
    scene.setNodeBillboard(node, billboardAxis(behaviorsKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, behaviorsKey]);

  // Physics. Keyed on the serialised body so a changed collider re-attaches and
  // an unchanged one does not: rebuilding a rigid body every render would reset
  // its velocity every frame and nothing would ever fall.
  // The body's renderer tag is a unique key (see viroCollisions.ts); the
  // viroTag and onCollision are read through it when a collision arrives.
  //
  // A hidden body, its own `visible` or an ancestor's, is out of the world, as
  // native stops simulating it; shown again, it starts from where its node is.
  // An ancestor's visibility reaches no prop here, so it is polled while there
  // is a body. The first read waits out the commit: parents register after
  // their children, so until then a hidden parent is not known to be hidden.
  const physicsKey = props.physicsBody ? JSON.stringify(props.physicsBody) : "";
  const [shown, setShown] = useState<boolean | null>(null);
  shownRef.current = shown;
  useEffect(() => {
    if (!physicsKey) return;
    let frame = 0;
    let stopped = false;
    const step = () => {
      if (stopped) return;
      frame = requestAnimationFrame(step);
      setShown(effectivelyVisible(scene, node));
    };
    queueMicrotask(step);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, !!physicsKey]);
  // instantVelocity is a launch, sent as native sends it: when its value
  // changes, not again when another field changes or the node reappears.
  const launchedRef = useRef("");
  useEffect(() => {
    if (!propsRef.current.physicsBody) launchedRef.current = "";
    if (!propsRef.current.physicsBody || shown !== true) {
      scene.clearPhysicsBody(node);
      return;
    }
    const registration = registerCollisionBody(
      scene,
      () => propsRef.current.viroTag ?? "",
      () => propsRef.current.onCollision,
    );
    bodyKeyRef.current = registration.key;
    const launch = JSON.stringify(propsRef.current.physicsBody.instantVelocity ?? null);
    const launched = launchedRef.current === launch;
    launchedRef.current = launch;
    const body = launched ? { ...propsRef.current.physicsBody, instantVelocity: undefined } : propsRef.current.physicsBody;
    // A body changed mid-drag stays held until the drag lets it go.
    applyPhysicsBody(
      scene,
      node,
      heldRef.current ? { ...body, type: "Kinematic", instantVelocity: undefined } : body,
      registration.key,
    );
    return () => {
      scene.clearPhysicsBody(node);
      registration.unregister();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, physicsKey, shown]);

  // onTransformUpdate. Native's transform delegate reports however the node
  // moved (props, animation, physics, drag), so the drawn transform is polled.
  const wantsTransform = !!props.onTransformUpdate;
  useEffect(() => {
    if (!wantsTransform || typeof scene.getNodeWorldTransform !== "function") return;
    let frame = 0;
    let last: Vec3 | null = null;
    const step = () => {
      frame = requestAnimationFrame(step);
      const position = localPosition(scene, node, parent);
      if (!position) return;
      if (last && Math.hypot(...sub(position, last)) < TRANSFORM_DISTANCE_FILTER) return;
      last = position;
      propsRef.current.onTransformUpdate?.(position);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, wantsTransform]);

  const vec = (v: number[] | undefined): Vec3 => [v?.[0] ?? 0, v?.[1] ?? 0, v?.[2] ?? 0];
  useImperativeHandle(
    props.ref,
    () => ({
      applyImpulse: (force, position) => {
        const { central, torque } = offsetImpulse(vec(force), vec(position));
        scene.applyPhysicsImpulse(node, central);
        if (torque.some((c) => c !== 0)) scene.applyPhysicsTorque(node, torque);
      },
      applyTorqueImpulse: (torque) => scene.applyPhysicsTorque(node, vec(torque)),
      setVelocity: (velocity) => scene.setPhysicsVelocity(node, vec(velocity), false),
      getTransformAsync: async () => {
        const t = typeof scene.getNodeWorldTransform === "function" ? scene.getNodeWorldTransform(node) : null;
        if (!t) throw new Error("[Viro web] getTransformAsync needs a newer @reactvision/viro-web-renderer");
        return t;
      },
      getBoundingBoxAsync: async () => {
        const boundingBox = typeof scene.getNodeBoundingBox === "function" ? scene.getNodeBoundingBox(node) : null;
        if (!boundingBox) throw new Error("[Viro web] getBoundingBoxAsync needs a newer @reactvision/viro-web-renderer");
        return { boundingBox };
      },
      getMorphTargets: async () => ({ targets: scene.getMorphTargetKeys(node) }),
      setNativeProps: (nativeProps) => {
        const { position: p, rotation: r, scale: sc, opacity: o, visible: v, ...rest } = nativeProps;
        if (p) scene.setNodePosition(node, p[0], p[1], p[2]);
        if (r) scene.setNodeRotation(node, r[0] * DEG2RAD, r[1] * DEG2RAD, r[2] * DEG2RAD);
        if (sc) scene.setNodeScale(node, sc[0], sc[1], sc[2]);
        if (o !== undefined) scene.setNodeOpacity(node, o);
        if (v !== undefined) {
          nativeVisibleRef.current = v;
          scene.setNodeVisible(node, v);
        }
        if (Object.keys(rest).length) {
          warnUnsupported(
            "setNativeProps beyond position, rotation, scale, opacity and visible",
            "the web",
            "Pass the others as props.",
          );
        }
      },
      ...extraRefMethods,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [node],
  );

  // Animation (declarative ViroAnimation or model animation).
  useViroAnimation(
    node,
    props.animation,
    { position: [px, py, pz], rotation: [rx, ry, rz], scale: [sx, sy, sz], opacity },
    contentReady,
    ownMaterial,
  );

  return node;
}

// A missing pivot is [0,0,0], which is the engine's default, so nothing is sent
// until one is first set; after that, removing it sends the zeros.
function useNodePivot(
  scene: ViroSceneApi,
  node: ViroHandle,
  pivot: [number, number, number] | undefined,
  kind: "rotation" | "scale",
): void {
  const [x, y, z] = pivot ?? [0, 0, 0];
  const sentRef = useRef(false);
  useEffect(() => {
    if (x === 0 && y === 0 && z === 0 && !sentRef.current) return;
    const sent =
      kind === "rotation"
        ? scene.setNodeRotationPivot?.(node, x, y, z)
        : scene.setNodeScalePivot?.(node, x, y, z);
    if (!sent) {
      warnUnsupported(`${kind}Pivot with this build of the web renderer`, "the web");
      return;
    }
    sentRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, x, y, z]);
}
