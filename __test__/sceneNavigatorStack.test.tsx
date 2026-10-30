/**
 * Scene stack behaviour shared by the scene navigators: user style and viroAppProps handling,
 * replace on the top scene, and scene instances keyed by tag so they survive neighbours leaving.
 */
jest.mock("react-native", () => ({
  NativeModules: {},
  Platform: {
    OS: "ios",
    select: (o: any) => o.ios ?? o.default,
    constants: { reactNativeVersion: { major: 0, minor: 86, patch: 1, prerelease: null } },
  },
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  requireNativeComponent: (name: string) => name,
  findNodeHandle: () => null,
  processColor: (c: any) => c,
  View: "View",
  Text: "Text",
}));

import * as React from "react";
import { Viro3DSceneNavigator } from "../components/Viro3DSceneNavigator";
import { withoutRootTag } from "../components/Utilities/ViroAppProps";

const scene = () => null;
const A = { scene };
const B = { scene };
const C = { scene };

// The navigator is driven without a renderer: setState applies its updater synchronously, in
// order, as React does for queued updates.
function create(props: Record<string, unknown> = {}) {
  const nav = new Viro3DSceneNavigator({ initialScene: A, ...props } as any);
  (nav as any).setState = (update: any) => {
    const next = typeof update === "function" ? update(nav.state, nav.props) : update;
    (nav as any).state = { ...nav.state, ...next };
  };
  return nav;
}

const keys = (nav: Viro3DSceneNavigator) =>
  nav._renderSceneStackItems().map((el: React.ReactElement) => el.key);

describe("scene navigator stack", () => {
  it("merges the user's style after the container style", () => {
    const nav = create({ style: { backgroundColor: "red" } });
    const { style } = (nav.render() as React.ReactElement<any>).props;
    expect(style).toEqual([expect.objectContaining({ flex: 1 }), { backgroundColor: "red" }]);
  });

  it("replace with only the key of the top scene keeps that scene", () => {
    const nav = create();
    nav.push("b", B);
    expect(() => nav.replace("b")).not.toThrow();
    expect(keys(nav)).toHaveLength(2);
    expect(nav.state.sceneDictionary.b.sceneClass).toBe(B);
    expect(nav.state.sceneHistory.slice(-1)).toEqual(["b"]);
  });

  it("replace swaps the top scene", () => {
    const nav = create();
    nav.push("b", B);
    nav.replace("c", C);
    expect(Object.keys(nav.state.sceneDictionary).slice(1)).toEqual(["c"]);
    expect(nav.state.sceneHistory).toHaveLength(2);
  });

  it("keys scenes by tag, so a neighbour leaving does not shift them", () => {
    const nav = create();
    nav.push("b", B);
    nav.push("c", C);
    const root = nav.state.sceneHistory[0];
    expect(keys(nav)).toEqual([root, "b", "c"]);
    nav.jump(root);
    nav.pop();
    expect(keys(nav)).toEqual(["b", "c"]);
  });

  it("does not modify the previous state when the stack changes", () => {
    const nav = create();
    const before = { dict: nav.state.sceneDictionary, history: nav.state.sceneHistory };
    const snapshot = JSON.stringify(before);
    nav.push("b", B);
    nav.pop();
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("does not modify the user's viroAppProps", () => {
    const viroAppProps = Object.freeze({ rootTag: 11, user: "x" });
    const nav = create({ viroAppProps });
    expect(() => nav.render()).not.toThrow();
    expect(viroAppProps).toEqual({ rootTag: 11, user: "x" });
    expect(withoutRootTag(viroAppProps)).toEqual({ user: "x" });
  });
});
