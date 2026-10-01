/**
 * What the node factory actually emits, per asset type.
 *
 * Both hosts render from this one factory, so every prop it forgets is forgotten
 * on all three surfaces at once and every prop it emits conditionally is a place
 * the surfaces can drift. The cases here are the ones that have gone wrong:
 * tap-to-place mounting an asset before it was placed, a material_config that
 * reached no model, and a draw order that was Android's alone.
 *
 * The Viro components are stubbed to their names — this asserts the props the
 * factory hands them, not what they do with them, which is each host's own
 * business and is tested where it happens.
 */
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
jest.mock("../components/Viro3DObject", () => ({ Viro3DObject: "Viro3DObject" }));
jest.mock("../components/ViroImage", () => ({ ViroImage: "ViroImage" }));
jest.mock("../components/ViroText", () => ({ ViroText: "ViroText" }));
jest.mock("../components/ViroVideo", () => ({ ViroVideo: "ViroVideo" }));

import * as React from "react";
import { createNode } from "../components/Studio/domain/viroNodeFactory";
import { StudioPlacementStore } from "../components/Studio/domain/placementStore";
import { StudioVisibilityStore } from "../components/Studio/domain/visibilityStore";
import type { StudioAsset } from "../components/Studio/types";

const now = "2026-01-01T00:00:00.000Z";

function asset(partial: Partial<StudioAsset> & Pick<StudioAsset, "id" | "asset_type_name">): StudioAsset {
  return {
    name: "asset",
    description: null,
    file_url: "https://example.test/model.glb",
    file_size: null,
    position_x: 0,
    position_y: 0,
    position_z: -2,
    rotation_x: 0,
    rotation_y: 0,
    rotation_z: 0,
    scale: 1,
    latitude: null,
    longitude: null,
    is_draggable: false,
    hidden_on_load: false,
    trigger_image_url: null,
    trigger_image_orientation: null,
    trigger_image_physical_width_m: null,
    material_config: null,
    physics_config: null,
    on_click_function: null,
    asset_id: null,
    created_at: now,
    updated_at: now,
    scene_function: null,
    ...partial,
  } as StudioAsset;
}

/** The element the wrappers are hiding, whatever wrapped it. */
function inner(el: React.ReactElement | null): React.ReactElement {
  let cur = el as React.ReactElement;
  while (cur && typeof cur.type !== "string") {
    const child = (cur.props as { children?: unknown }).children;
    if (!React.isValidElement(child)) break;
    cur = child;
  }
  return cur;
}

const emptyScene = null;

function build(a: StudioAsset, runtimeCtx?: unknown) {
  return createNode(
    a,
    undefined,
    [],
    emptyScene,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    runtimeCtx as never,
  );
}

describe("the node factory's props", () => {
  test("draw order is the renderer's default on every platform", () => {
    // Studio used to hand Android a renderingOrder of 1 for models alone, which
    // drew every model after all the text and images no matter where it stood.
    const el = inner(build(asset({ id: "m", asset_type_name: "3D-MODEL" })));
    expect(el.type).toBe("Viro3DObject");
    expect((el.props as Record<string, unknown>).renderingOrder).toBeUndefined();
  });

  test("a material_config becomes a shaderOverride, and nothing else does", () => {
    // The override is what reaches a loaded model's own materials; `materials`
    // only replaces the geometry a node draws itself, which a GLB's root has
    // none of.
    const plain = inner(build(asset({ id: "m", asset_type_name: "3D-MODEL" })));
    expect((plain.props as Record<string, unknown>).shaderOverrides).toBeUndefined();

    const styled = inner(
      build(
        asset({
          id: "m2",
          asset_type_name: "3D-MODEL",
          material_config: { diffuseColor: "#ff0000" },
        }),
      ),
    );
    expect((styled.props as Record<string, unknown>).shaderOverrides).toEqual(["studio_m2"]);
  });

  test("a tap-to-place asset is withheld until it is placed", () => {
    // Without the wrapper the node mounts at once, at an offset meant to be
    // added to a tap point that never happened — which puts it on the camera.
    const placementStore = new StudioPlacementStore();
    const a = asset({
      id: "p",
      asset_type_name: "3D-MODEL",
      scene_function: JSON.stringify({ type: "TAP_TO_PLACE" }),
    });
    const withStore = build(a, { placementStore });
    expect(withStore).not.toBeNull();
    // The outermost wrapper is the gate, not the asset itself.
    expect(typeof withStore!.type).not.toBe("string");
    expect((withStore!.props as Record<string, unknown>).assetId).toBe("p");
  });

  test("every asset is wrapped so Set Visibility can reach it", () => {
    const visibilityStore = new StudioVisibilityStore();
    const el = build(asset({ id: "v", asset_type_name: "TEXT" }), { visibilityStore });
    expect(el).not.toBeNull();
    expect((el!.props as Record<string, unknown>).assetId).toBe("v");
    // TEXT is the one type the factory hands to a component of its own rather
    // than straight to a Viro element, because its string is interpolated from
    // the variable store; the wrapper still has to carry the asset through.
    const wrapper = inner(el);
    expect(typeof wrapper.type).toBe("function");
    expect((wrapper.props as { asset: StudioAsset }).asset.id).toBe("v");
  });

  test("an image gets the surface props, not a model's", () => {
    const el = inner(
      build(asset({ id: "i", asset_type_name: "IMAGE", file_url: "https://example.test/a.png" })),
    );
    expect(el.type).toBe("ViroImage");
    expect((el.props as Record<string, unknown>).source).toEqual({
      uri: "https://example.test/a.png",
    });
  });

  test("an unknown type is dropped rather than guessed at", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(build(asset({ id: "x", asset_type_name: "HOLOGRAM" }))).toBeNull();
    warn.mockRestore();
  });

  test("a model with no file is dropped", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(build(asset({ id: "n", asset_type_name: "3D-MODEL", file_url: null }))).toBeNull();
    warn.mockRestore();
  });

  test("the authored transform reaches the node", () => {
    const el = inner(
      build(
        asset({
          id: "t",
          asset_type_name: "3D-MODEL",
          position_x: 1,
          position_y: 2,
          position_z: -3,
          rotation_y: 90,
          scale: 0.5,
        }),
      ),
    );
    const props = el.props as Record<string, unknown>;
    expect(props.position).toEqual([1, 2, -3]);
    expect(props.rotation).toEqual([0, 90, 0]);
    expect(props.scale).toEqual([0.5, 0.5, 0.5]);
  });
});

describe("asset load failures", () => {
  function withErrorHandler(a: StudioAsset, onAssetError: (a: StudioAsset, e: Error) => void) {
    return createNode(
      a, undefined, [], emptyScene, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined, null,
      undefined, onAssetError,
    );
  }

  test("reach the host with the asset, not only the console", () => {
    // They used to go to console.error alone, which no error tracker hooks.
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const seen: Array<[string, string]> = [];
    const record = (a: StudioAsset, e: Error) => seen.push([a.id, e.message]);
    for (const [id, type] of [["m", "3D-MODEL"], ["i", "IMAGE"], ["v", "VIDEO"]] as const) {
      const el = inner(withErrorHandler(asset({ id, asset_type_name: type }), record));
      (el.props as { onError: (e: unknown) => void }).onError(new Error(`${id} failed`));
    }
    expect(seen).toEqual([["m", "m failed"], ["i", "i failed"], ["v", "v failed"]]);
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });

  test("a native error event arrives as an Error", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    let got: Error | null = null;
    const el = inner(
      withErrorHandler(asset({ id: "m", asset_type_name: "3D-MODEL" }), (_a, e) => { got = e; }),
    );
    (el.props as { onError: (e: unknown) => void }).onError({ nativeEvent: { error: "bad glb" } });
    expect(got).toBeInstanceOf(Error);
    expect((got as unknown as Error).message).toContain("bad glb");
    spy.mockRestore();
  });

  test("without a handler they are still logged", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const el = inner(build(asset({ id: "m", asset_type_name: "3D-MODEL" })));
    (el.props as { onError: (e: unknown) => void }).onError(new Error("x"));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
