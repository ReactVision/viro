/**
 * react-native-web's Alert.alert does nothing, so a Studio ALERT on the web is
 * drawn by StudioWebAlertOverlay from the shared alert store.
 */
jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
  NativeModules: {},
  Platform: { OS: "web", select: (o: any) => o.web ?? o.default },
}));

import * as React from "react";
import { act } from "react";
import TestRenderer, { type ReactTestRenderer } from "react-test-renderer";
import { Alert } from "react-native";
import { StudioWebAlertOverlay } from "../components/Studio/StudioWebAlertOverlay";
import {
  questAlertStore,
  showStudioAlert,
} from "../components/Studio/domain/questAlertStore";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
// The tests run in node; the overlay only listens for Escape and Enter on it.
(globalThis as any).window = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

const textOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAll((n) => typeof n.type === "string")
    .flatMap((n) => n.children.filter((c) => typeof c === "string"));

afterEach(() => questAlertStore.reset());

describe("StudioWebAlertOverlay", () => {
  it("shows a scene's alert and dismisses it with its button", () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<StudioWebAlertOverlay />);
    });
    expect(tree.toJSON()).toBeNull();

    act(() => showStudioAlert("Hello", "Line one", "Got it"));
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(textOf(tree)).toEqual(["Hello", "Line one", "Got it"]);

    act(() => tree.root.findByType("button").props.onClick());
    expect(tree.toJSON()).toBeNull();
  });

  it("clears the alert when the navigator goes, not before", () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<StudioWebAlertOverlay />);
    });
    act(() => showStudioAlert("", "Bye"));
    expect(questAlertStore.isActive()).toBe(true);
    act(() => tree.unmount());
    expect(questAlertStore.isActive()).toBe(false);
  });
});
