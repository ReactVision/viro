/**
 * performARHitTestWithWorldPoints reaches its own native method.
 *
 * The wrapper called the native performARHitTestWithRay with (tag, origin,
 * destination). That method takes (tag, ray), so the call failed on its
 * argument count, and iOS's performARHitTestWithWorldPoints took (tag, ray)
 * and never settled its promise. Mounting ViroARScene needs a renderer this
 * suite does not have, so the wiring is checked in the sources.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import * as fs from "fs";
import * as path from "path";

const root = path.join(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

describe("performARHitTestWithWorldPoints", () => {
  it("calls the native world-points method with origin and destination", () => {
    const src = read("components/AR/ViroARScene.tsx");
    const body = src.slice(src.indexOf("performARHitTestWithWorldPoints = async"));
    const call = body.slice(0, body.indexOf("};"));
    expect(call).toContain("VRTARSceneModule.performARHitTestWithWorldPoints(");
    expect(call).not.toContain("VRTARSceneModule.performARHitTestWithRay(");
    expect(call).toMatch(/origin,\s*destination/);
  });

  it("has an iOS signature that takes origin and destination and resolves", () => {
    const mm = read("ios/ViroReact/AR/Modules/VRTARSceneModule.mm");
    const start = mm.indexOf("RCT_EXPORT_METHOD(performARHitTestWithWorldPoints:");
    expect(start).toBeGreaterThan(-1);
    const method = mm.slice(start, mm.indexOf("RCT_EXPORT_METHOD(", start + 1));
    expect(method).toMatch(/origin:\(NSArray \*\)origin\s+destination:\(NSArray \*\)destination/);
    expect(method).toContain("resolve(");
  });

  it("matches the Android native arguments", () => {
    const java = read("android/viro_bridge/src/main/java/com/viromedia/bridge/module/ARSceneModule.java");
    expect(java).toMatch(/performARHitTestWithWorldPoints\(final int viewTag, final ReadableArray origin, final ReadableArray destination/);
  });
});
