/**
 * ViroController on the web: scene-wide handlers through the renderer's controller delegate.
 */
let mockRenderer: Record<string, any> = {};
const mockScene: Record<string, any> = {};
jest.mock("../components/Web/ViroWebContext", () => ({
  useViroRenderer: () => mockRenderer,
  useViroScene: () => mockScene,
}));

import * as React from "react";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import { ViroController } from "../components/ViroController.web";
import { resetUnsupportedWarnings } from "../components/Utilities/ViroUnsupported";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function mount(props: Record<string, any>) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<ViroController {...props} />);
  });
  return tree;
}

beforeEach(() => {
  resetUnsupportedWarnings();
  mockRenderer = {
    scene: mockScene,
    setControllerEventHandlers: jest.fn(() => true),
    clearControllerEventHandlers: jest.fn(),
  };
});

describe("ViroController on the web", () => {
  it("registers only the handlers it has, and maps clicks and rotation as native does", () => {
    const onClick = jest.fn();
    const onClickState = jest.fn();
    const onRotate = jest.fn();
    const tree = mount({ onClick, onClickState, onRotate });
    const [owner, handlers] = mockRenderer.setControllerEventHandlers.mock.calls[0];
    expect(handlers.onPinch).toBeUndefined();
    expect(handlers.onFuse).toBeUndefined();

    handlers.onClick(1, 2, []);
    handlers.onClick(3, 2, []);
    expect(onClickState.mock.calls.map((c) => c[0])).toEqual([1, 3]);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith([], 2);

    handlers.onRotate(2, Math.PI / 2, 1);
    expect(onRotate.mock.calls[0][1]).toBeCloseTo(90);

    act(() => tree.unmount());
    expect(mockRenderer.clearControllerEventHandlers).toHaveBeenCalledWith(owner);
  });

  it("takes onFuse as a function or as { callback }", () => {
    const callback = jest.fn();
    mount({ onFuse: { callback, timeToFuse: 500 } });
    mockRenderer.setControllerEventHandlers.mock.calls[0][1].onFuse(4);
    expect(callback).toHaveBeenCalledWith(4);
  });

  it("warns once on a renderer without the controller delegate", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockRenderer.setControllerEventHandlers = jest.fn(() => false);
    mount({ onClick: jest.fn() });
    mount({ onClick: jest.fn() });
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("ViroController")).length).toBe(1);
    warn.mockRestore();
  });

  it("says once that hand-controller events do not reach the web", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    mount({ onSwipe: jest.fn() });
    expect(mockRenderer.setControllerEventHandlers).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
