/**
 * The web renderer reports neither the start of a declarative animation nor
 * the end of one that is not looping, so useViroAnimation times both. Before
 * that, a property animation's onStart and onFinish never ran on the web.
 */
const mockScene = {
  beginAnimation: jest.fn(),
  commitAnimation: jest.fn(),
  setNodePosition: jest.fn(),
  setNodeRotation: jest.fn(),
  setNodeScale: jest.fn(),
  setNodeOpacity: jest.fn(),
  startAnimation: jest.fn(),
  pauseAnimation: jest.fn(),
  resumeAnimation: jest.fn(),
  stopAnimation: jest.fn(),
  supportsAnimationPause: true,
  getAnimationKeys: jest.fn(() => ["Clip"]),
};
const mockRenderer = {
  setNodeAnimationHandlers: jest.fn(),
  clearNodeAnimationHandlers: jest.fn(),
};
jest.mock("../components/Web/ViroWebContext", () => ({
  useViroScene: () => mockScene,
  useViroRenderer: () => mockRenderer,
}));

import * as React from "react";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import {
  useViroAnimation,
  type ViroAnimationProp,
} from "../components/Web/useViroAnimation";
import {
  registerViroAnimations,
  type ViroBaseTransform,
} from "../components/Web/viroAnimationRegistry";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).requestAnimationFrame = (cb: () => void) => setTimeout(cb, 16);
(globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);

const base: ViroBaseTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  opacity: 1,
};

function Probe({
  animation,
  at = base,
}: {
  animation: ViroAnimationProp;
  at?: ViroBaseTransform;
}) {
  useViroAnimation(7, animation, at, true);
  return null;
}

function mount(animation: ViroAnimationProp) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<Probe animation={animation} />);
  });
  return tree;
}

beforeAll(() =>
  registerViroAnimations({
    rise: { duration: 500, properties: { positionY: "+=1" } },
    riseEased: { duration: 1000, easing: "EaseInEaseOut", properties: { positionY: "+=1" } },
    pulse: { duration: 500, properties: { scaleX: 2 } },
    riseTwice: [["rise", "rise"]],
  }),
);

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(performance, "now").mockImplementation(() => Date.now());
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("useViroAnimation callbacks", () => {
  test("a declarative pass reports its start after the delay and its end after the duration", () => {
    const onStart = jest.fn();
    const onFinish = jest.fn();
    const tree = mount({ name: "rise", run: true, delay: 200, onStart, onFinish });

    act(() => jest.advanceTimersByTime(100));
    expect(onStart).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(150));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(500));
    expect(onFinish).toHaveBeenCalledTimes(1);

    // Not left to the renderer too, or a fixed renderer would report it twice.
    expect(mockRenderer.setNodeAnimationHandlers).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  test("a stopped pass reports no end", () => {
    const onFinish = jest.fn();
    const tree = mount({ name: "rise", run: true, onFinish });
    act(() => jest.advanceTimersByTime(100));
    act(() => tree.unmount());
    act(() => jest.advanceTimersByTime(1000));
    expect(onFinish).not.toHaveBeenCalled();
  });

  test("an absolute loop reports each cycle's start and end, as native does", () => {
    const onStart = jest.fn();
    const onFinish = jest.fn();
    const tree = mount({ name: "pulse", run: true, loop: true, onStart, onFinish });
    act(() => jest.advanceTimersByTime(1100));
    expect(onFinish).toHaveBeenCalledTimes(2);
    expect(onStart).toHaveBeenCalledTimes(3);
    expect(mockRenderer.setNodeAnimationHandlers).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  test("a model animation keeps the renderer's own start and end", () => {
    const onStart = jest.fn();
    const onFinish = jest.fn();
    const tree = mount({ name: "Clip", run: true, onStart, onFinish });
    expect(mockScene.startAnimation).toHaveBeenCalledWith(7, "Clip", false);
    expect(mockRenderer.setNodeAnimationHandlers).toHaveBeenCalledWith(7, { onStart, onFinish: expect.any(Function) });
    mockRenderer.setNodeAnimationHandlers.mock.calls[0][1].onFinish();
    expect(onFinish).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  test("run false pauses a model animation and true resumes it, as native, without starting over", () => {
    const tree = mount({ name: "Clip", run: true });
    act(() => tree.update(<Probe animation={{ name: "Clip", run: false }} />));
    expect(mockScene.pauseAnimation).toHaveBeenCalledWith(7);
    act(() => tree.update(<Probe animation={{ name: "Clip", run: true }} />));
    expect(mockScene.resumeAnimation).toHaveBeenCalledWith(7);
    expect(mockScene.startAnimation).toHaveBeenCalledTimes(1);
    expect(mockScene.stopAnimation).not.toHaveBeenCalled();
    act(() => tree.unmount());
  });

  test("a finished model animation plays again from the start when run turns true again", () => {
    const tree = mount({ name: "Clip", run: true });
    act(() => mockRenderer.setNodeAnimationHandlers.mock.calls[0][1].onFinish());
    act(() => tree.update(<Probe animation={{ name: "Clip", run: false }} />));
    expect(mockScene.pauseAnimation).not.toHaveBeenCalled();
    act(() => tree.update(<Probe animation={{ name: "Clip", run: true }} />));
    expect(mockScene.startAnimation).toHaveBeenCalledTimes(2);
    act(() => tree.unmount());
  });

  test("run false holds a declarative pass, and its end moves by the pause", () => {
    const onFinish = jest.fn();
    const tree = mount({ name: "riseEased", run: true, onFinish });
    act(() => jest.advanceTimersByTime(250));
    act(() => tree.update(<Probe animation={{ name: "riseEased", run: false, onFinish }} />));
    expect(mockScene.pauseAnimation).toHaveBeenCalledWith(7);
    act(() => jest.advanceTimersByTime(2000));
    expect(onFinish).not.toHaveBeenCalled();
    act(() => tree.update(<Probe animation={{ name: "riseEased", run: true, onFinish }} />));
    expect(mockScene.resumeAnimation).toHaveBeenCalledWith(7);
    act(() => jest.advanceTimersByTime(700));
    expect(onFinish).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(100));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(mockScene.beginAnimation).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  test("without renderer support, run false drops a declarative pass and true starts a new one", () => {
    mockScene.supportsAnimationPause = false;
    try {
      const onFinish = jest.fn();
      const tree = mount({ name: "rise", run: true, onFinish });
      act(() => jest.advanceTimersByTime(100));
      act(() => tree.update(<Probe animation={{ name: "rise", run: false, onFinish }} />));
      expect(mockScene.pauseAnimation).not.toHaveBeenCalled();
      act(() => jest.advanceTimersByTime(1000));
      expect(onFinish).not.toHaveBeenCalled();
      act(() => tree.update(<Probe animation={{ name: "rise", run: true, onFinish }} />));
      expect(mockScene.beginAnimation).toHaveBeenCalledTimes(2);
      act(() => tree.unmount());
    } finally {
      mockScene.supportsAnimationPause = true;
    }
  });

  test("a model animation waits out its delay, and a stop inside it cancels the start", () => {
    const tree = mount({ name: "Clip", run: true, delay: 300 });
    act(() => jest.advanceTimersByTime(250));
    expect(mockScene.startAnimation).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(100));
    expect(mockScene.startAnimation).toHaveBeenCalledWith(7, "Clip", false);
    act(() => tree.unmount());

    mockScene.startAnimation.mockClear();
    const stopped = mount({ name: "Clip", run: true, delay: 300 });
    act(() => stopped.unmount());
    act(() => jest.advanceTimersByTime(500));
    expect(mockScene.startAnimation).not.toHaveBeenCalled();
  });
});

describe("useViroAnimation and relative values", () => {
  const lastY = () => {
    const calls = mockScene.setNodePosition.mock.calls;
    return calls[calls.length - 1][2];
  };

  test("a repeat carries on from where the last pass left the node", () => {
    const tree = mount({ name: "rise", run: true });
    expect(lastY()).toBe(1);
    act(() => jest.advanceTimersByTime(600));
    act(() => tree.update(<Probe animation={{ name: "rise", run: false }} />));
    act(() => tree.update(<Probe animation={{ name: "rise", run: true }} />));
    expect(lastY()).toBe(2);
    act(() => tree.unmount());
  });

  test("an interrupted pass carries on from the point its curve reached", () => {
    const tree = mount({ name: "riseEased", run: true });
    // EaseInEaseOut at t = 0.25 is 2 * 0.25^2 = 0.125.
    act(() => jest.advanceTimersByTime(250));
    act(() => tree.update(<Probe animation={{ name: "rise", run: true }} />));
    expect(lastY()).toBeCloseTo(1.125);
    act(() => tree.unmount());
  });

  test("an interrupted chain carries on from the step it was in", () => {
    const tree = mount({ name: "riseTwice", run: true });
    act(() => jest.advanceTimersByTime(750));
    act(() => tree.update(<Probe animation={{ name: "rise", run: true }} />));
    expect(lastY()).toBeCloseTo(2.5);
    act(() => tree.unmount());
  });

  test("an authored change starts over from the new transform", () => {
    const tree = mount({ name: "rise", run: true });
    act(() => jest.advanceTimersByTime(600));
    const moved: ViroBaseTransform = { ...base, position: [0, 5, 0] };
    act(() => tree.update(<Probe animation={{ name: "rise", run: true }} at={moved} />));
    expect(lastY()).toBe(6);
    act(() => tree.unmount());
  });
});
