/**
 * `requireNativeComponent` does not check that the native side registered the view. It hands
 * React a component whose native half may be missing, and the first mount then fails with
 * "View config not found for component VRTObjectDetectorView" and takes the screen down. That is
 * how 3.0.2 behaved on every iPhone: the archive iOS links had been built without the detector.
 * The component now asks React Native first and degrades through its own error channel.
 */
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";

// react-test-renderer flushes effects inside act() only when told this is an act environment.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockHasViewManagerConfig = jest.fn<boolean, [string]>();

jest.mock("react-native", () => ({
  NativeModules: {},
  Platform: { OS: "ios", constants: {} },
  UIManager: {
    hasViewManagerConfig: (name: string) => mockHasViewManagerConfig(name),
  },
  // A string type renders as a host node, so the test can see what would reach the native side.
  requireNativeComponent: (name: string) => name,
}));

import {
  ViroObjectDetector,
  VIRO_OBJECT_DETECTOR_UNAVAILABLE_ERROR,
  resetObjectDetectorNativeViewCheck,
} from "../components/ViroObjectDetector";
import { resetUnsupportedWarnings } from "../components/Utilities/ViroUnsupported";

// react-test-renderer logs its own deprecation on every create(); nothing here depends on it.
const consoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    if (String(args[0]).includes("react-test-renderer is deprecated")) return;
    consoleError(...args);
  });
});
afterAll(() => (console.error as jest.Mock).mockRestore());

function mount(props: React.ComponentProps<typeof ViroObjectDetector> = {}) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<ViroObjectDetector {...props} />);
  });
  return renderer;
}

describe("ViroObjectDetector when the native view is not in the build", () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    resetObjectDetectorNativeViewCheck();
    resetUnsupportedWarnings();
    mockHasViewManagerConfig.mockReset();
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => warn.mockRestore());

  it("renders nothing and reports through onError instead of throwing", () => {
    mockHasViewManagerConfig.mockReturnValue(false);
    const onError = jest.fn();

    const renderer = mount({ onError, onDetection: () => {} });

    expect(renderer.toJSON()).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({ error: VIRO_OBJECT_DETECTOR_UNAVAILABLE_ERROR });
    expect(VIRO_OBJECT_DETECTOR_UNAVAILABLE_ERROR).toContain("VRTObjectDetectorView");
  });

  it("warns once, so a detector without onError still says why it is silent", () => {
    mockHasViewManagerConfig.mockReturnValue(false);

    mount();
    mount();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("ViroObjectDetector");
  });

  it("reports once per mount, not once per render", () => {
    mockHasViewManagerConfig.mockReturnValue(false);
    const onError = jest.fn();

    const renderer = mount({ onError });
    act(() => {
      renderer.update(<ViroObjectDetector onError={onError} maxFPS={5} />);
    });

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("asks React Native once, however many detectors mount", () => {
    mockHasViewManagerConfig.mockReturnValue(true);

    mount();
    mount();

    expect(mockHasViewManagerConfig).toHaveBeenCalledTimes(1);
    expect(mockHasViewManagerConfig).toHaveBeenCalledWith("VRTObjectDetectorView");
  });
});

describe("ViroObjectDetector when the native view is registered", () => {
  beforeEach(() => {
    resetObjectDetectorNativeViewCheck();
    mockHasViewManagerConfig.mockReset();
    mockHasViewManagerConfig.mockReturnValue(true);
  });

  it("mounts VRTObjectDetectorView with its defaults and leaves onError alone", () => {
    const onError = jest.fn();
    const onDetection = jest.fn();

    const tree = mount({ onError, onDetection }).toJSON() as TestRenderer.ReactTestRendererJSON;

    expect(tree.type).toBe("VRTObjectDetectorView");
    expect(tree.props.model).toBe("yoloe-26s");
    expect(tree.props.mode).toBe("prompt-free");
    expect(typeof tree.props.onDetectionViro).toBe("function");
    expect(typeof tree.props.onErrorViro).toBe("function");
    expect(onError).not.toHaveBeenCalled();
  });

  it("forwards a native error event to onError", () => {
    const onError = jest.fn();
    const tree = mount({ onError }).toJSON() as TestRenderer.ReactTestRendererJSON;

    act(() => {
      tree.props.onErrorViro({ nativeEvent: { error: "model not found" } });
    });

    expect(onError).toHaveBeenCalledWith({ error: "model not found" });
  });
});
