/**
 * Co-location on Quest reaches native.
 *
 * The regression this guards against shipped once and was invisible for a
 * release. `metaSpatialAnchorFrameSource` reported `support.ok === true` on
 * Quest, so a scene compiled and read as supported; then `acquire()` looked for
 * `rvCreateSharedFrame` on the navigator it was handed, did not find it, and
 * returned "This navigator does not expose shared frames". Every layer beneath
 * was finished — VROARSessionOpenXRSharedFrame.cpp drives Meta's group sharing,
 * ARScene exposes both calls — and nothing forwarded.
 *
 * So what is tested here is not the anchor. It is the forwarding: that the
 * object the Quest branch of ViroXRSceneNavigator builds carries the two names
 * the frame source reaches for, and that their results come back in the shape
 * it expects. A unit test cannot open an OpenXR session; it can make sure the
 * call is not dropped before it gets there.
 */
import * as fs from "fs";
import * as path from "path";
import { metaSpatialAnchorFrameSource } from "../components/AR/ViroFrameSource";

jest.mock("../components/Utilities/ViroPlatform", () => ({
  isQuest: true,
  isVisionOS: false,
  isWeb: false,
}));

const GROUP = "7c1e4a88-0000-4000-8000-0123456789ab";
/** Identity, row-major, as the native side returns it. */
const IDENTITY = "1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1";

describe("metaSpatialAnchorFrameSource on Quest", () => {
  it("is keyed on the group so one uuid names the space, the frame and the room", () => {
    const src = metaSpatialAnchorFrameSource(GROUP, "create");
    expect(src.key).toBe(GROUP);
    expect(src.support.ok).toBe(true);
  });

  it("calls rvCreateSharedFrame when publishing, and rvJoinSharedFrame when joining", async () => {
    const nav = {
      rvCreateSharedFrame: jest.fn().mockResolvedValue({ success: true, transform: IDENTITY }),
      rvJoinSharedFrame: jest.fn().mockResolvedValue({ success: true, transform: IDENTITY }),
    };

    await metaSpatialAnchorFrameSource(GROUP, "create").acquire({ arSceneNavigator: nav } as any);
    expect(nav.rvCreateSharedFrame).toHaveBeenCalledWith(GROUP);
    expect(nav.rvJoinSharedFrame).not.toHaveBeenCalled();

    nav.rvCreateSharedFrame.mockClear();
    await metaSpatialAnchorFrameSource(GROUP, "join").acquire({ arSceneNavigator: nav } as any);
    expect(nav.rvJoinSharedFrame).toHaveBeenCalledWith(GROUP);
    expect(nav.rvCreateSharedFrame).not.toHaveBeenCalled();
  });

  it("turns the native transform into a frame", async () => {
    const nav = {
      rvCreateSharedFrame: jest.fn().mockResolvedValue({
        success: true,
        frameId: "frame-1",
        transform: "1,0,0,0,0,1,0,0,0,0,1,0,1,2,3,1",
      }),
    };
    const outcome = await metaSpatialAnchorFrameSource(GROUP, "create").acquire({
      arSceneNavigator: nav,
    } as any);

    expect(outcome.success).toBe(true);
    if (!outcome.success) return;
    // The anchor sits at the reference-space origin, so the pose native returns
    // is the frame — translation read straight back out of the last row.
    expect(outcome.frame.position).toEqual([1, 2, 3]);
    expect(outcome.frame.transform).toBe("1,0,0,0,0,1,0,0,0,0,1,0,1,2,3,1");
  });

  it("reports a navigator with no shared-frame methods rather than throwing", async () => {
    // This is the exact failure that shipped: the Quest bridge object carried
    // push/pop/project/unproject and nothing else.
    const bare = { push: jest.fn(), pop: jest.fn(), project: jest.fn(), unproject: jest.fn() };
    const outcome = await metaSpatialAnchorFrameSource(GROUP, "create").acquire({
      arSceneNavigator: bare,
    } as any);

    expect(outcome.success).toBe(false);
    if (outcome.success) return;
    expect(outcome.error).toMatch(/does not expose shared frames/);
  });

  it("passes a native failure through instead of reporting a frame", async () => {
    // A VR scene has no AR session, which is the commonest real failure.
    const nav = {
      rvCreateSharedFrame: jest.fn().mockResolvedValue({
        success: false,
        error: "Co-location needs a mixed-reality scene.",
      }),
    };
    const outcome = await metaSpatialAnchorFrameSource(GROUP, "create").acquire({
      arSceneNavigator: nav,
    } as any);

    expect(outcome.success).toBe(false);
    if (outcome.success) return;
    expect(outcome.error).toMatch(/mixed-reality scene/);
  });
});

/**
 * The forwarding itself, read off the source.
 *
 * The tests above prove the frame source calls what it is given. This proves
 * the navigator gives it the right thing — which is the half that was missing,
 * and the half a mock can never catch, because a mock is not what ships.
 */
describe("the Quest navigator exposes the shared-frame methods", () => {
  const root = path.resolve(__dirname, "..");
  const navigator = fs.readFileSync(
    path.join(root, "components", "ViroXRSceneNavigator.tsx"),
    "utf-8"
  );

  it("builds its Quest bridge with rvCreateSharedFrame and rvJoinSharedFrame on it", () => {
    const quest = navigator.slice(
      navigator.indexOf("const bridgeNav = {"),
      navigator.indexOf("return { sceneNavigator: bridgeNav")
    );
    expect(quest).toContain("rvCreateSharedFrame");
    expect(quest).toContain("rvJoinSharedFrame");
  });

  it("routes them through VRModuleOpenXR, not ARSceneNavigatorModule", () => {
    // ARSceneNavigatorModule resolves its view as a VRTARSceneNavigator and
    // rejects anything else with "Invalid view type". VRActivity hosts a
    // VRTVRSceneNavigator, so that module is the wrong door on Quest.
    expect(navigator).toMatch(/VRModuleOpenXR\?\.rvCreateSharedFrame/);
    expect(navigator).toMatch(/VRModuleOpenXR\?\.rvJoinSharedFrame/);
  });

  it("declares both on the module's type, so a rename cannot pass typecheck", () => {
    const module = fs.readFileSync(
      path.join(root, "components", "Utilities", "VRModuleOpenXR.ts"),
      "utf-8"
    );
    expect(module).toContain("rvCreateSharedFrame?:");
    expect(module).toContain("rvJoinSharedFrame?:");
  });

  it("has the native methods behind it on both Java layers", () => {
    const bridge = path.join(root, "android", "viro_bridge", "src", "main", "java", "com", "viromedia", "bridge");
    const module = fs.readFileSync(path.join(bridge, "module", "VRModuleOpenXR.java"), "utf-8");
    const view = fs.readFileSync(path.join(bridge, "component", "VRTVRSceneNavigator.java"), "utf-8");

    // The @ReactMethod pair JS reaches, and the view methods they call.
    expect(module).toMatch(/@ReactMethod\s+public void rvCreateSharedFrame/);
    expect(module).toMatch(/@ReactMethod\s+public void rvJoinSharedFrame/);
    expect(view).toContain("public void rvCreateSharedFrame");
    expect(view).toContain("public void rvJoinSharedFrame");
    // And the view must reach an ARScene — a VR scene has no AR session.
    expect(view).toContain("getCurrentARScene");
  });
});
