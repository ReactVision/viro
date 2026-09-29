jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: "active",
  },
  NativeModules: {},
  Platform: { OS: "ios", select: (o: any) => o.ios ?? o.default },
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  processColor: (c: any) => c,
}));
jest.mock("../components/Viro3DObject", () => ({
  Viro3DObject: "Viro3DObject",
}));
jest.mock("../components/ViroImage", () => ({ ViroImage: "ViroImage" }));
jest.mock("../components/ViroText", () => ({ ViroText: "ViroText" }));
jest.mock("../components/ViroVideo", () => ({ ViroVideo: "ViroVideo" }));

import * as React from "react";
import { StudioDragStore } from "../components/Studio/domain/dragStore";
import { StudioPlacementStore } from "../components/Studio/domain/placementStore";
import {
  createNode,
  dragNodeProps,
} from "../components/Studio/domain/viroNodeFactory";
import type { StudioAsset, StudioSceneMeta } from "../components/Studio/types";

type Vec3 = [number, number, number];

function asset(over: Partial<StudioAsset> = {}): StudioAsset {
  return {
    id: "crate",
    name: "crate",
    asset_type_name: "3D-MODEL",
    file_url: "https://example.test/crate.glb",
    position_x: 0,
    position_y: 0,
    position_z: -2,
    rotation_x: 0,
    rotation_y: 0,
    rotation_z: 0,
    scale: 1,
    is_draggable: true,
    hidden_on_load: false,
    tap_to_place: false,
    tap_to_place_order: null,
    trigger_image_url: null,
    material_config: null,
    physics_config: { type: "Dynamic", mass: 1 },
    scene_function: null,
    ...over,
  } as StudioAsset;
}

const SCENE = {
  id: "scene-1",
  plane_detection: "NONE",
  physics_world_config: { enabled: true },
} as unknown as StudioSceneMeta;

function build(
  a: StudioAsset,
  runtimeCtx: unknown,
  notify?: (assetId: string, worldPosition?: Vec3) => void
) {
  return createNode(
    a,
    undefined,
    [],
    SCENE,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    notify,
    undefined,
    runtimeCtx as never
  );
}

/** Each element down the wrapper chain, outermost first. */
function chain(el: React.ReactElement | null): React.ReactElement[] {
  const out: React.ReactElement[] = [];
  let cur = el;
  while (cur) {
    out.push(cur);
    const child = (cur.props as { children?: unknown }).children;
    cur = React.isValidElement(child) ? child : null;
  }
  return out;
}

const props = (el: React.ReactElement) => el.props as Record<string, any>;

describe("StudioDragStore", () => {
  it("repaints only the asset another device moved", () => {
    const store = new StudioDragStore();
    const crate = jest.fn();
    const door = jest.fn();
    store.subscribe("crate", crate);
    store.subscribe("door", door);
    store.applyRemote("crate", [1, 0, 0], true);
    expect(store.getPosition("crate")).toEqual([1, 0, 0]);
    expect(store.isLocked("crate")).toBe(true);
    expect(crate).toHaveBeenCalledTimes(1);
    expect(door).not.toHaveBeenCalled();
    store.applyRemote("crate", [1, 0, 0], true);
    expect(crate).toHaveBeenCalledTimes(1);
  });

  it("bumps the revision for a forced repaint of an unchanged position only", () => {
    const store = new StudioDragStore();
    store.applyRemote("crate", [1, 0, 0], false);
    store.applyRemote("crate", [1, 0, 0], false, true);
    expect(store.revision("crate")).toBe(1);
    store.applyRemote("crate", [2, 0, 0], false, true);
    expect(store.revision("crate")).toBe(1);
  });

  it("passes this device's drags on without holding them", () => {
    const store = new StudioDragStore();
    const moves: Array<[string, Vec3]> = [];
    store.subscribeMoves((id, p) => moves.push([id, p]));
    const repaint = jest.fn();
    store.subscribe("crate", repaint);
    store.moved("crate", [0, 1, 2]);
    expect(moves).toEqual([["crate", [0, 1, 2]]]);
    expect(store.getPosition("crate")).toBeUndefined();
    expect(repaint).not.toHaveBeenCalled();
  });

  it("puts everything back on reset", () => {
    const store = new StudioDragStore();
    store.applyRemote("crate", [1, 0, 0], true);
    const repaint = jest.fn();
    store.subscribe("crate", repaint);
    store.reset();
    expect(store.getPosition("crate")).toBeUndefined();
    expect(store.isLocked("crate")).toBe(false);
    expect(repaint).toHaveBeenCalledTimes(1);
  });
});

describe("dragNodeProps", () => {
  const free = { locked: false, revision: 0 };

  it("puts the node where another device dragged it, over the placed position", () => {
    expect(
      dragNodeProps(
        { ...free, position: [1, 2, 3] },
        { position: [9, 9, 9], rotation: [0, 90, 0], visible: true },
        [0, 0, -2],
        false
      )
    ).toEqual({ position: [1, 2, 3], rotation: [0, 90, 0], visible: true });
  });

  it("passes what the wrappers set and leaves out what they did not", () => {
    expect(
      dragNodeProps(
        free,
        { visible: false, position: undefined },
        [0, 0, -2],
        false
      )
    ).toEqual({ visible: false, position: [0, 0, -2] });
  });

  it("cannot be dragged here while another device holds it, and follows it as a kinematic body", () => {
    const body = { type: "Kinematic" };
    const locked = dragNodeProps(
      { position: [1, 0, 0], locked: true, revision: 0 },
      {},
      undefined,
      false,
      body
    );
    expect(locked).toHaveProperty("onDrag", undefined);
    expect(locked.physicsBody).toBe(body);
    const text = dragNodeProps(
      { locked: true, revision: 0 },
      {},
      [0, 0, 0],
      true
    );
    expect(text.dragLocked).toBe(true);
    expect(text).not.toHaveProperty("onDrag");
  });

  it("makes a forced repaint a change the renderer is sent", () => {
    const a = dragNodeProps(
      { position: [1, 2, 3], locked: false, revision: 0 },
      {},
      undefined,
      false
    );
    const b = dragNodeProps(
      { position: [1, 2, 3], locked: false, revision: 1 },
      {},
      undefined,
      false
    );
    expect(b.position).not.toEqual(a.position);
    (b.position as number[]).forEach((v, i) =>
      expect(v).toBeCloseTo([1, 2, 3][i], 5)
    );
    // No drag override: the node's own position is repainted.
    const own = dragNodeProps(
      { locked: false, revision: 1 },
      {},
      [0, 0, -2],
      false
    );
    expect(own.position).not.toEqual([0, 0, -2]);
  });
});

describe("the node factory in a shared session", () => {
  it("wraps a draggable node in the scene's drag store", () => {
    const dragStore = new StudioDragStore();
    const el = build(asset(), { dragStore });
    const [visible, drag, node] = chain(el);
    expect(props(visible).assetId).toBe("crate");
    expect(props(drag).store).toBe(dragStore);
    expect(props(drag).lockedPhysicsBody).toMatchObject({ type: "Kinematic" });
    expect(node.type).toBe("Viro3DObject");
  });

  it("puts the drag wrapper inside the tap-to-place gate, so a drag wins over the placement", () => {
    const dragStore = new StudioDragStore();
    const placementStore = new StudioPlacementStore();
    const a = asset({ tap_to_place: true, tap_to_place_order: 1 });
    placementStore.seed([a]);
    const [placeable, drag, node] = chain(
      build(a, { dragStore, placementStore })
    );
    expect(props(placeable).store).toBe(placementStore);
    expect(props(drag).store).toBe(dragStore);
    expect(node.type).toBe("Viro3DObject");
  });

  it("leaves image-triggered and non-draggable content unwrapped", () => {
    const dragStore = new StudioDragStore();
    for (const a of [
      asset({ trigger_image_url: "https://example.test/poster.jpg" }),
      asset({ is_draggable: false }),
    ]) {
      const [visible, node] = chain(build(a, { dragStore }));
      expect(props(visible).assetId).toBe("crate");
      expect(node.type).toBe("Viro3DObject");
    }
  });

  it("reports where a drag moved the node", () => {
    const notify = jest.fn();
    const node = chain(build(asset(), {}, notify)).pop()!;
    props(node).onDrag([0.5, 0, -1], 0);
    expect(notify).toHaveBeenCalledWith("crate", [0.5, 0, -1]);
  });
});
