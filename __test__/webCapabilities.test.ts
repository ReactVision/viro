/**
 * What the web host declares it cannot do.
 *
 * The point of these is completeness, not correctness of any one string: a gap
 * missing from this list is a scene that opens fine and then silently does
 * nothing. Gaze, proximity, collision and tap-to-place were all in that state.
 */
import { webUnsupportedFeatures } from "../components/Studio/domain/webCapabilities";
import type { StudioSceneResponse } from "../components/Studio/types";

const asset = (over: Record<string, unknown> = {}) =>
  ({ id: "a1", name: "asset", ...over }) as never;

function sceneData(over: Record<string, unknown> = {}): StudioSceneResponse {
  return {
    scene: { id: "s1", plane_detection: "NONE" },
    project: {},
    assets: [],
    collision_bindings: [],
    animations: [],
    functions: [],
    meta: { request_id: "r" },
    ...over,
  } as never;
}

describe("webUnsupportedFeatures", () => {
  test("a scene with nothing unsupported reports nothing", () => {
    expect(webUnsupportedFeatures(sceneData({ assets: [asset()] }))).toEqual([]);
  });

  test("reports gaze and collision, which this host cannot run at all", () => {
    // Gaze is a headset affordance the native host only wires on Quest;
    // collisions need a physics world web has none of.
    expect(
      webUnsupportedFeatures(
        sceneData({ gaze_bindings: [{}], collision_bindings: [{}] }),
      ),
    ).toEqual(["gaze triggers", "collision triggers"]);
  });

  test("reports proximity only where the distances would be wrong", () => {
    const bindings = { proximity_bindings: [{}] };

    // Assets at scene root: their authored position is their world position, so
    // the distance the runtime measures is the real one.
    expect(
      webUnsupportedFeatures(
        sceneData({ scene: { id: "s1", plane_detection: "NONE" }, ...bindings }),
      ),
    ).toEqual([]);

    // Inside a plane wrapper the position is plane-local and web cannot read a
    // world transform, so the metres would be off with no sign of it.
    expect(
      webUnsupportedFeatures(
        sceneData({
          scene: { id: "s1", plane_detection: "AUTOMATIC" },
          ...bindings,
        }),
      ),
    ).toEqual(["proximity triggers"]);
  });

  test("reports tap to place only where there is no camera to tap against", () => {
    const scene = sceneData({ assets: [asset({ tap_to_place: true })] });
    // AR runs the guided queue, so there is nothing to warn about.
    expect(webUnsupportedFeatures(scene, "ar")).toEqual([]);
    // 3d has no tracked camera to hit-test, so the queue would never advance.
    expect(webUnsupportedFeatures(scene, "3d")).toContain("tap to place");
  });

  test("an image marker wins over tap to place, and only markers are reported", () => {
    // isTapToPlaceAsset's rule: a marker anchors its own content, so the asset
    // is not a tap-to-place one at all and reporting both would be wrong.
    const features = webUnsupportedFeatures(
      sceneData({
        assets: [asset({ tap_to_place: true, trigger_image_url: "u" })],
      }),
      "3d",
    );
    expect(features).toEqual(["image markers"]);
  });

  test("reports physics only when something would have simulated", () => {
    const body = asset({ physics_config: { enabled: true, type: "Dynamic" } });

    // World on and a body present: the one case where physics is really lost.
    expect(
      webUnsupportedFeatures(
        sceneData({
          scene: { id: "s1", physics_world_config: { enabled: true } },
          assets: [body],
        }),
      ),
    ).toContain("physics");

    // World off gates every body on both surfaces, so there is nothing to warn
    // about — a false warning here is what trains people to ignore the banner.
    expect(
      webUnsupportedFeatures(
        sceneData({
          scene: { id: "s1", physics_world_config: { enabled: false } },
          assets: [body],
        }),
      ),
    ).not.toContain("physics");

    // World on but no body: nothing would have simulated either.
    expect(
      webUnsupportedFeatures(
        sceneData({
          scene: { id: "s1", physics_world_config: { enabled: true } },
          assets: [asset()],
        }),
      ),
    ).not.toContain("physics");
  });

  test("reports manual plane selection, which has no web picker", () => {
    expect(
      webUnsupportedFeatures(
        sceneData({ scene: { id: "s1", plane_detection: "MANUAL" } }),
      ),
    ).toEqual(["manual plane selection"]);
  });
});
