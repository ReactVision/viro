import { ViroARTrackingTargets } from "../components/AR/ViroARTrackingTargets";
import { registerTriggerImageTargets } from "../components/Studio/domain/triggerImageRegistry";
import { StudioAsset } from "../components/Studio/types";

jest.mock("../components/AR/ViroARTrackingTargets", () => ({
  ViroARTrackingTargets: { createTargets: jest.fn(), deleteTarget: jest.fn() },
}));

const createTargets = ViroARTrackingTargets.createTargets as jest.Mock;

type Targets = Record<
  string,
  { source: { uri: string }; orientation: string; physicalWidth: number }
>;

const asset = (id: string, extra: Partial<StudioAsset>): StudioAsset =>
  ({ id, name: id, ...extra }) as unknown as StudioAsset;

/** The target record handed to the native module. */
const registered = (): Targets => createTargets.mock.calls[0][0] as Targets;

const MARKER = "https://cdn.example/marker.png";
const OTHER = "https://cdn.example/other.png";

beforeEach(() => {
  createTargets.mockClear();
});

describe("registerTriggerImageTargets", () => {
  it("registers one target for placements that ask for the same picture", () => {
    const map = registerTriggerImageTargets([
      asset("a", { trigger_image_url: MARKER }),
      asset("b", { trigger_image_url: MARKER }),
      asset("c", { trigger_image_url: OTHER }),
    ]);

    // Every registered target has to be reachable through the map, or it is a
    // native download no ViroARImageMarker can mount against.
    expect(Object.keys(registered()).sort()).toEqual(
      [...new Set(map.values())].sort()
    );
    expect(Object.keys(registered())).toHaveLength(2);
    expect(map.get("a")).toBe(map.get("b"));
    expect(map.get("c")).not.toBe(map.get("a"));
    expect(registered()[map.get("a")!]!.source.uri).toBe(MARKER);
  });

  it("keeps a separate target when the same picture is tracked differently", () => {
    const map = registerTriggerImageTargets([
      asset("up", { trigger_image_url: MARKER }),
      asset("down", {
        trigger_image_url: MARKER,
        trigger_image_orientation: "Down",
      }),
      asset("wide", {
        trigger_image_url: MARKER,
        trigger_image_physical_width_m: 0.5,
      }),
    ]);

    expect(Object.keys(registered())).toHaveLength(3);
    expect(registered()[map.get("up")!]).toMatchObject({
      orientation: "Up",
      physicalWidth: 0.2,
    });
    expect(registered()[map.get("down")!]).toMatchObject({
      orientation: "Down",
      physicalWidth: 0.2,
    });
    expect(registered()[map.get("wide")!]).toMatchObject({
      orientation: "Up",
      physicalWidth: 0.5,
    });
  });

  it("registers nothing when no placement carries a trigger image", () => {
    expect(registerTriggerImageTargets([asset("a", {})]).size).toBe(0);
    expect(createTargets).not.toHaveBeenCalled();
  });
});
