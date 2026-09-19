import { cloudAnchorFrameSource } from "../components/AR/ViroFrameSource";

jest.mock("../components/Utilities/ViroPlatform", () => ({
  isQuest: false,
  isVisionOS: false,
  isWeb: false,
}));

const ANCHOR = "3f2b9c10-0000-4000-8000-abcdefabcdef";

const navWith = (result: unknown) => ({
  resolveCloudAnchor: jest.fn().mockResolvedValue(result),
});

describe("cloudAnchorFrameSource", () => {
  it("keys the frame on the anchor id — that is the room key for the channel", () => {
    const src = cloudAnchorFrameSource(ANCHOR);
    expect(src.key).toBe(ANCHOR);
    expect(src.support.ok).toBe(true);
  });

  it("maps a resolved anchor onto a frame", async () => {
    const nav = navWith({
      success: true,
      state: "Success",
      anchor: {
        anchorId: ANCHOR,
        cloudAnchorId: ANCHOR,
        state: "Success",
        position: [1, 2, 3],
        rotation: [0, 90, 0],
        scale: [1, 1, 1],
        resolvedTransform: "1,0,0,0,0,1,0,0,0,0,1,0,1,2,3,1",
      },
    });

    const outcome = await cloudAnchorFrameSource(ANCHOR).acquire({
      arSceneNavigator: nav,
    });

    expect(nav.resolveCloudAnchor).toHaveBeenCalledWith(ANCHOR);
    expect(outcome).toEqual({
      success: true,
      frame: {
        position: [1, 2, 3],
        rotation: [0, 90, 0],
        scale: [1, 1, 1],
        transform: "1,0,0,0,0,1,0,0,0,0,1,0,1,2,3,1",
      },
    });
  });

  it("carries the native failure through rather than inventing one", async () => {
    const nav = navWith({
      success: false,
      error: "Localisation timed out — move closer to the anchor location",
      state: "ErrorCloudIdNotFound",
    });

    const outcome = await cloudAnchorFrameSource(ANCHOR).acquire({
      arSceneNavigator: nav,
    });

    expect(outcome).toEqual({
      success: false,
      error: "Localisation timed out — move closer to the anchor location",
      state: "ErrorCloudIdNotFound",
    });
  });

  it("turns a thrown bridge error into an outcome, not a rejection", async () => {
    const nav = {
      resolveCloudAnchor: jest.fn().mockRejectedValue(new Error("bridge is gone")),
    };

    // A rejecting acquire would escape ViroSharedFrame's await and surface as an
    // unhandled rejection instead of onLocalizeError.
    await expect(
      cloudAnchorFrameSource(ANCHOR).acquire({ arSceneNavigator: nav })
    ).resolves.toEqual({
      success: false,
      error: "bridge is gone",
      state: "ErrorInternal",
    });
  });

  it("reports a navigator that cannot resolve at all", async () => {
    const outcome = await cloudAnchorFrameSource(ANCHOR).acquire({
      arSceneNavigator: {},
    });
    expect(outcome.success).toBe(false);
  });
});

describe("cloudAnchorFrameSource on headsets", () => {
  const withPlatform = async (flags: { isQuest?: boolean; isVisionOS?: boolean }) => {
    jest.resetModules();
    jest.doMock("../components/Utilities/ViroPlatform", () => ({
      isQuest: !!flags.isQuest,
      isVisionOS: !!flags.isVisionOS,
      isWeb: false,
    }));
    const mod = await import("../components/AR/ViroFrameSource");
    return mod.cloudAnchorFrameSource(ANCHOR);
  };

  it("is unsupported on Quest, with the reason attached", async () => {
    const src = await withPlatform({ isQuest: true });
    expect(src.support.ok).toBe(false);
    if (!src.support.ok) expect(src.support.reason).toMatch(/Quest/);
  });

  it("is unsupported on visionOS, with the reason attached", async () => {
    const src = await withPlatform({ isVisionOS: true });
    expect(src.support.ok).toBe(false);
    if (!src.support.ok) expect(src.support.reason).toMatch(/visionOS/);
  });
});

describe("metaSpatialAnchorFrameSource", () => {
  const GROUP = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

  const onQuest = async () => {
    jest.resetModules();
    jest.doMock("../components/Utilities/ViroPlatform", () => ({
      isQuest: true,
      isVisionOS: false,
      isWeb: false,
    }));
    return await import("../components/AR/ViroFrameSource");
  };

  it("keys on the group id — one id names space, frame and room", async () => {
    const { metaSpatialAnchorFrameSource } = await onQuest();
    const src = metaSpatialAnchorFrameSource(GROUP);
    expect(src.key).toBe(GROUP);
    expect(src.support.ok).toBe(true);
  });

  it("is unsupported off Quest", async () => {
    jest.resetModules();
    jest.doMock("../components/Utilities/ViroPlatform", () => ({
      isQuest: false, isVisionOS: false, isWeb: false,
    }));
    const { metaSpatialAnchorFrameSource } = await import("../components/AR/ViroFrameSource");
    expect(metaSpatialAnchorFrameSource(GROUP).support.ok).toBe(false);
  });

  it("routes create and join to different native calls", async () => {
    const { metaSpatialAnchorFrameSource } = await onQuest();
    const nav = {
      rvCreateSharedFrame: jest.fn().mockResolvedValue({ success: true, transform: IDENTITY_CSV }),
      rvJoinSharedFrame: jest.fn().mockResolvedValue({ success: true, transform: IDENTITY_CSV }),
    };

    await metaSpatialAnchorFrameSource(GROUP, "create").acquire({ arSceneNavigator: nav });
    expect(nav.rvCreateSharedFrame).toHaveBeenCalledWith(GROUP);
    expect(nav.rvJoinSharedFrame).not.toHaveBeenCalled();

    await metaSpatialAnchorFrameSource(GROUP, "join").acquire({ arSceneNavigator: nav });
    expect(nav.rvJoinSharedFrame).toHaveBeenCalledWith(GROUP);
  });

  it("decomposes the transform, since native returns only the matrix", async () => {
    const { metaSpatialAnchorFrameSource } = await onQuest();
    // 90° yaw about +Y, translated to (2, 0, 3).
    const csv = "0,0,-1,0,0,1,0,0,1,0,0,0,2,0,3,1";
    const nav = { rvJoinSharedFrame: jest.fn().mockResolvedValue({ success: true, transform: csv }) };

    const outcome = await metaSpatialAnchorFrameSource(GROUP).acquire({ arSceneNavigator: nav });
    expect(outcome.success).toBe(true);
    if (!outcome.success) return;

    expect(outcome.frame.position).toEqual([2, 0, 3]);
    expect(outcome.frame.rotation[1]).toBeCloseTo(90, 4);
    outcome.frame.scale.forEach((s) => expect(s).toBeCloseTo(1, 5));
    // The opaque token survives for the mesh APIs.
    expect(outcome.frame.transform).toBe(csv);
  });

  it("carries a native failure through", async () => {
    const { metaSpatialAnchorFrameSource } = await onQuest();
    const nav = {
      rvJoinSharedFrame: jest.fn().mockResolvedValue({
        success: false,
        error: "no shared frame published to this group yet",
      }),
    };
    const outcome = await metaSpatialAnchorFrameSource(GROUP).acquire({ arSceneNavigator: nav });
    expect(outcome).toMatchObject({
      success: false,
      error: "no shared frame published to this group yet",
    });
  });
});

const IDENTITY_CSV = "1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1";
