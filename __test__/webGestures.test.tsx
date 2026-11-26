/**
 * Pinch, rotate and fuse on web nodes, and the ref methods native's ViroBase has.
 */
const mockHandlers = new Map<number, any>();
const mockRenderer = {
  setNodeEventHandlers: jest.fn((node: number, h: any) => mockHandlers.set(node, h)),
  clearNodeEventHandlers: jest.fn(),
};
let mockSceneBase: Record<string, any> = {};
// Any scene method a test does not set is a jest.fn returning 0.
const mockScene = new Proxy({} as Record<string, any>, {
  get: (_t, key: string) => {
    if (key in mockSceneBase) return mockSceneBase[key];
    return (mockSceneBase[key] = jest.fn(() => 0));
  },
});
jest.mock("../components/Web/ViroWebContext", () => ({
  useViroScene: () => mockScene,
  useViroRenderer: () => mockRenderer,
  useViroParentNode: () => 0,
}));

import * as React from "react";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import { useViroNode, useViroSceneEvents, type ViroWebNodeHandle, type ViroWebNodeProps } from "../components/Web/useViroNode";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function Probe(props: ViroWebNodeProps) {
  useViroNode(props);
  return null;
}

function mount(props: ViroWebNodeProps) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<Probe {...props} />);
  });
  return tree;
}

const enabled = () => mockSceneBase.setNodeEventEnabled.mock.calls.map((c: any[]) => c[1]);

beforeEach(() => {
  mockHandlers.clear();
  jest.clearAllMocks();
  mockSceneBase = { createNode: jest.fn(() => 5), supportsGestures: true };
});

describe("pinch, rotate and fuse on the web", () => {
  it("enables only the gestures a node handles, and reports rotation in degrees", () => {
    const onPinch = jest.fn();
    const onRotate = jest.fn();
    mount({ onPinch, onRotate });
    expect(enabled()).toEqual([10, 11]);

    const h = mockHandlers.get(5);
    h.onPinch(2, 1.5, 1);
    h.onRotate(3, Math.PI / 2, 1);
    expect(onPinch).toHaveBeenCalledWith(2, 1.5, 1);
    expect(onRotate.mock.calls[0][0]).toBe(3);
    expect(onRotate.mock.calls[0][1]).toBeCloseTo(90);
  });

  it("takes onFuse as a function or as { callback, timeToFuse }", () => {
    const fuse = jest.fn();
    mount({ onFuse: fuse });
    expect(enabled()).toEqual([9]);
    expect(mockSceneBase.setNodeTimeToFuse).toHaveBeenCalledWith(5, 2000);
    mockHandlers.get(5).onFuse(1);
    expect(fuse).toHaveBeenCalledWith(1);

    const callback = jest.fn();
    mount({ onFuse: { callback, timeToFuse: 500 } });
    expect(mockSceneBase.setNodeTimeToFuse).toHaveBeenLastCalledWith(5, 500);
    mockHandlers.get(5).onFuse(1);
    expect(callback).toHaveBeenCalledWith(1);
  });

  it("says so on a renderer from before gestures", () => {
    delete mockSceneBase.supportsGestures;
    mockSceneBase.setNodeTimeToFuse = undefined;
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    mount({ onPinch: jest.fn(), onFuse: jest.fn() });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("onPinch"));
    warn.mockRestore();
  });
});

describe("scene-level gestures on the web", () => {
  function SceneProbe(props: ViroWebNodeProps) {
    useViroSceneEvents(props);
    return null;
  }

  it("gives the scene root its timeToFuse, and switches every gesture off on unmount", () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<SceneProbe onPinch={jest.fn()} onRotate={jest.fn()} onFuse={{ callback: jest.fn(), timeToFuse: 500 }} />);
    });
    expect(mockSceneBase.setNodeTimeToFuse).toHaveBeenCalledWith(0, 500);
    act(() => tree.unmount());
    const off = mockSceneBase.setNodeEventEnabled.mock.calls.filter((c: any[]) => c[2] === false).map((c: any[]) => c[1]);
    expect(off).toEqual(expect.arrayContaining([9, 10, 11]));
  });
});

describe("a node ref on the web", () => {
  function handleOf(extra: ViroWebNodeProps = {}) {
    const ref = React.createRef<ViroWebNodeHandle>();
    mount({ ...extra, ref });
    return ref.current!;
  }

  it("reads the transform, bounding box and morph targets in native's shapes", async () => {
    const transform = { position: [1, 2, 3], rotation: [0, 90, 0], scale: [1, 1, 1] };
    const box = { minX: -1, maxX: 1, minY: 0, maxY: 2, minZ: -1, maxZ: 1 };
    mockSceneBase.getNodeWorldTransform = jest.fn(() => transform);
    mockSceneBase.getNodeBoundingBox = jest.fn(() => box);
    mockSceneBase.getMorphTargetKeys = jest.fn(() => ["smile"]);
    const handle = handleOf();
    await expect(handle.getTransformAsync()).resolves.toEqual(transform);
    await expect(handle.getBoundingBoxAsync()).resolves.toEqual({ boundingBox: box });
    await expect(handle.getMorphTargets()).resolves.toEqual({ targets: ["smile"] });
  });

  it("rejects the reads on a renderer that cannot answer them", async () => {
    mockSceneBase.getNodeWorldTransform = undefined;
    await expect(handleOf().getTransformAsync()).rejects.toThrow("getTransformAsync");
  });

  it("applies the transform keys of setNativeProps and warns about the rest", () => {
    const handle = handleOf();
    mockSceneBase.setNodePosition.mockClear();
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    handle.setNativeProps({ position: [0, 1, -2], rotation: [0, 180, 0], opacity: 0.5 });
    expect(mockSceneBase.setNodePosition).toHaveBeenCalledWith(5, 0, 1, -2);
    expect(mockSceneBase.setNodeRotation.mock.calls.at(-1)[2]).toBeCloseTo(Math.PI);
    expect(mockSceneBase.setNodeOpacity).toHaveBeenLastCalledWith(5, 0.5);
    expect(warn).not.toHaveBeenCalled();
    handle.setNativeProps({ materials: ["red"] });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("setNativeProps"));
    warn.mockRestore();
  });
});

describe("ignoreEventHandling on the web", () => {
  it("makes the node unselectable, and selectable again when cleared", () => {
    const tree = mount({ ignoreEventHandling: true });
    expect(mockSceneBase.setNodeSelectable).toHaveBeenLastCalledWith(5, false);
    act(() => tree.update(<Probe ignoreEventHandling={false} />));
    expect(mockSceneBase.setNodeSelectable).toHaveBeenLastCalledWith(5, true);
  });

  it("warns instead of throwing on a renderer before 1.2.0", () => {
    mockSceneBase.setNodeSelectable = undefined;
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => mount({ ignoreEventHandling: true })).not.toThrow();
    expect(warn.mock.calls.some((c) => String(c[0]).includes("ignoreEventHandling"))).toBe(true);
    warn.mockRestore();
  });
});

describe("pivots and highAccuracyEvents on the web", () => {
  it("sends nothing at the defaults", () => {
    mount({});
    expect(mockScene.setNodeRotationPivot).not.toHaveBeenCalled();
    expect(mockScene.setNodeScalePivot).not.toHaveBeenCalled();
    expect(mockScene.setNodeHighAccuracyEvents).not.toHaveBeenCalled();
  });

  it("sends a pivot, and zeros once it is removed", () => {
    mockSceneBase.setNodeRotationPivot = jest.fn(() => true);
    const tree = mount({ rotationPivot: [1, 0, 0] });
    expect(mockSceneBase.setNodeRotationPivot).toHaveBeenLastCalledWith(5, 1, 0, 0);
    act(() => tree.update(<Probe />));
    expect(mockSceneBase.setNodeRotationPivot).toHaveBeenLastCalledWith(5, 0, 0, 0);
  });

  it("takes highAccuracyGaze as the old name of highAccuracyEvents", () => {
    mockSceneBase.setNodeHighAccuracyEvents = jest.fn(() => true);
    mount({ highAccuracyGaze: true });
    expect(mockSceneBase.setNodeHighAccuracyEvents).toHaveBeenCalledWith(5, true);
  });
});

