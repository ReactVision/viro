/**
 * Copyright © 2026 ReactVision
 *
 * viroAppProps reach a Quest scene. ViroXRSceneNavigator's scene runs under VRActivity, a
 * separate React root, so the panel publishes its viroAppProps on the bridge and
 * ViroQuestEntryPoint reads them back. A subscriber that arrives late still gets the
 * current object, and only a new object notifies.
 */
import { VRQuestNavigatorBridge } from "../components/Utilities/VRQuestNavigatorBridge";

describe("VRQuestNavigatorBridge app props", () => {
  it("replays the current props to a late subscriber and notifies on change", () => {
    const first = { log: () => {} };
    VRQuestNavigatorBridge.setAppProps(first);

    const seen: any[] = [];
    const off = VRQuestNavigatorBridge.onAppProps((p) => seen.push(p));
    expect(seen).toEqual([first]);

    VRQuestNavigatorBridge.setAppProps(first);
    expect(seen).toHaveLength(1);

    const second = { log: () => {} };
    VRQuestNavigatorBridge.setAppProps(second);
    expect(seen).toEqual([first, second]);
    expect(VRQuestNavigatorBridge.getAppProps()).toBe(second);

    off();
    VRQuestNavigatorBridge.setAppProps({});
    expect(seen).toHaveLength(2);
  });
});
