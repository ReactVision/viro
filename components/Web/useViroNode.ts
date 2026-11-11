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
import { createMaterialFromRegistry } from "./viroMaterialRegistry";
import { useViroAnimation, type ViroAnimationProp } from "./useViroAnimation";
import { applyPhysicsBody, type ViroPhysicsBodyProp } from "./viroPhysicsBody";
import { registerCollisionBody } from "./viroCollisions";
import { cameraView, dragFollower, rayAt, releaseVelocity, sub, type DragPlane, type Vec3 } from "./viroDrag";
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
  /** Applied at the centre of mass: the web binding takes no offset. */
  applyImpulse(force: number[], position?: number[]): void;
  applyTorqueImpulse(torque: number[]): void;
  setVelocity(velocity: number[]): void;
};

export interface ViroWebNodeProps {
  position?: [number, number, number];
  rotation?: [number, number, number]; // degrees, Viro convention
  scale?: [number, number, number];
  opacity?: number;
  visible?: boolean;
  materials?: string | string[];
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
  animation?: ViroAnimationProp;
}

/**
 * The nodes this hook made, by scene and handle, so a press is routed up the
 * tree as native routes it. The renderer hands a press only to the first node
 * with clicks enabled, and a node here enables them to be dragged too, so its
 * clicks go on to the nearest ancestor that takes them, and a press on a
 * clickable child drags the nearest ancestor with onDrag.
 */
type NodeEntry = { parent: ViroHandle; props(): ViroWebNodeProps; startDrag(hit: Vec3): void };
const nodeEntries = new WeakMap<ViroSceneApi, Map<ViroHandle, NodeEntry>>();

function nearestNode(scene: ViroSceneApi, node: ViroHandle, wants: (p: ViroWebNodeProps) => boolean): NodeEntry | null {
  const map = nodeEntries.get(scene);
  let entry = map?.get(node);
  while (entry) {
    if (wants(entry.props())) return entry;
    entry = map!.get(entry.parent);
  }
  return null;
}

export function useViroNode(
  props: ViroWebNodeProps,
  createGeometry?: (scene: ViroSceneApi) => ViroHandle,
  // False until a loaded model's subtree exists. Gates the two things that need
  // it: its embedded animations, and the shader-override merge. A node whose
  // geometry this hook builds is ready on mount, hence the default.
  contentReady: boolean = true,
  // When provided, the geometry is rebuilt whenever this key changes (e.g. text
  // re-shapes). Omit for static geometry (box/sphere/surface) — built once.
  geometryKey?: string | number,
  // Factory for the underlying node (default `createNode`). Override for special
  // node types, e.g. portal scenes (`createPortalScene`).
  createNodeFn?: (scene: ViroSceneApi) => ViroHandle,
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
    scene.setNodeVisible(node, visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, visible]);

  // Dragging, which native enables with onDrag (dragType defaults to
  // FixedDistance). The renderer reports a press on the node; the moves are
  // followed here, on rays from the camera's published view (viroDrag.ts). A
  // dynamic body is held kinematic while dragged, as virocore's setKinematicDrag
  // does, and let go with the velocity of its last ~80 ms, so it can be thrown.
  const bodyKeyRef = useRef("");
  const heldRef = useRef(false);
  const startDrag = (hit: Vec3) => {
    const p = propsRef.current;
    const view = cameraView(scene);
    if (!p.onDrag || endDragRef.current) return;
    if (!view) {
      warnUnsupported("Dragging nodes (onDrag) outside the desktop preview camera", "the web");
      return;
    }
    const nodeStart = scene.getNodeWorldPosition(node);
    const parentWorld = scene.getNodeWorldPosition(parent);
    if (!nodeStart || !parentWorld) return;
    // A press virocore rerouted to a recently hovered node arrives at the origin;
    // native grabs such a node at its own position.
    const grab: Vec3 = hit.every((c) => c === 0) ? nodeStart : hit;
    const toGrab = sub(grab, view.position);
    const len = Math.hypot(...toGrab) || 1;
    const dragType = p.dragType ?? "FixedDistance";
    const follow = dragFollower(dragType, p.dragPlane, {
      ray: { origin: view.position, dir: [toGrab[0] / len, toGrab[1] / len, toGrab[2] / len] },
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
    const onMove = (e: PointerEvent) => {
      const to = follow(rayAt(view, e.clientX, e.clientY));
      if (!to) return;
      // Local = world minus the parent's world position: right while nothing above
      // the node is rotated or scaled, which holds for a plane anchor here.
      const local = sub(to, parentWorld);
      scene.setNodePosition(node, local[0], local[1], local[2]);
      samples.push({ t: performance.now(), p: to });
      if (samples.length > 12) samples.shift();
      propsRef.current.onDrag?.(to, 0);
    };
    const onUp = () => end();
    const end = (release = true) => {
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
      if (thrown && now) {
        applyPhysicsBody(scene, node, { ...now, instantVelocity: undefined }, bodyKeyRef.current);
        scene.setPhysicsVelocity(node, releaseVelocity(samples), false);
      }
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    endDragRef.current = end;
  };

  useEffect(() => {
    let map = nodeEntries.get(scene);
    if (!map) nodeEntries.set(scene, (map = new Map()));
    map.set(node, { parent, props: () => propsRef.current, startDrag });
    return () => {
      map.delete(node);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node]);

  // Events: register handlers once, reading the latest props off the ref above,
  // so a changed callback identity does not re-subscribe.
  const hasClick = !!(props.onClick || props.onClickState || props.onDrag);
  const hasHover = !!props.onHover;
  useEffect(() => {
    if (!hasClick && !hasHover) return;
    renderer.setNodeEventHandlers(node, {
      onClick: (clickState, source, position) => {
        if (clickState === ViroClickState.ClickDown) {
          nearestNode(scene, node, (p) => !!p.onDrag)?.startDrag(position);
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
    });
    if (hasClick) scene.setNodeEventEnabled(node, ViroEventAction.Click, true);
    if (hasHover) scene.setNodeEventEnabled(node, ViroEventAction.Hover, true);
    return () => renderer.clearNodeEventHandlers(node);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, hasClick, hasHover]);

  // Materials (first material applied to the geometry; MVP scope).
  const materialsKey = Array.isArray(props.materials)
    ? props.materials.join(",")
    : props.materials ?? "";
  useEffect(() => {
    const geo = geometryRef.current;
    if (!geo || !materialsKey) return;
    const firstName = materialsKey.split(",")[0];
    const material = createMaterialFromRegistry(scene, firstName);
    if (material) {
      scene.setGeometryMaterial(geo, material);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, materialsKey]);

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
    // and replaces them, so with several the last one wins. That is what the
    // native bridges do too, which is the point: the merge keeps the model's own
    // colours and textures on both surfaces.
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
  const physicsKey = props.physicsBody ? JSON.stringify(props.physicsBody) : "";
  useEffect(() => {
    if (!propsRef.current.physicsBody) {
      scene.clearPhysicsBody(node);
      return;
    }
    const registration = registerCollisionBody(
      scene,
      () => propsRef.current.viroTag ?? "",
      () => propsRef.current.onCollision,
    );
    bodyKeyRef.current = registration.key;
    const body = propsRef.current.physicsBody;
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
  }, [node, physicsKey]);

  const vec = (v: number[] | undefined): Vec3 => [v?.[0] ?? 0, v?.[1] ?? 0, v?.[2] ?? 0];
  useImperativeHandle(
    props.ref,
    () => ({
      applyImpulse: (force, position) => {
        if (position?.some((c) => c !== 0)) {
          warnUnsupported("applyImpulse at an offset", "the web", "The impulse is applied at the centre of mass.");
        }
        scene.applyPhysicsImpulse(node, vec(force));
      },
      applyTorqueImpulse: (torque) => scene.applyPhysicsTorque(node, vec(torque)),
      setVelocity: (velocity) => scene.setPhysicsVelocity(node, vec(velocity), false),
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
  );

  return node;
}
