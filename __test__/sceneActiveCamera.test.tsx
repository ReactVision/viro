/**
 * Which camera a scene draws from, as the native scene is told it.
 *
 * `ViroScene` used to call `VRTCameraModule.setSceneCamera` as each camera mounted, and the
 * module looked the camera up in the native view registry. Under the New Architecture a camera
 * mounted between its siblings has no native view yet: React Native's legacy interop holds a
 * child inserted anywhere but at the end of its parent until the parent next updates. The
 * module gave up and the scene stayed on its default camera. The scene now passes the active
 * camera's tag as the `activeCameraTag` prop of the native scene, which is itself the update
 * the interop waits for. These tests pin down what that prop says through the sequences the
 * bug report walks: a first mount, a remount through a new `key` mid-list, `active` moving
 * between cameras, and cameras leaving.
 */
jest.mock("react-native", () => ({
  requireNativeComponent: (name: string) => name,
  // The host tag of a camera: in the app, findNodeHandle on the ViroCamera instance resolves
  // the VRTCamera view's React tag. Here each camera declares its own.
  findNodeHandle: (instance: any) => instance?.props?.testTag ?? null,
  NativeModules: {
    VRTCameraModule: {
      setSceneCamera: jest.fn(),
      removeSceneCamera: jest.fn(),
    },
    VRTSceneModule: {},
  },
  Platform: { OS: "ios", select: (o: any) => o.ios ?? o.default },
  StyleSheet: { create: (s: any) => s, absoluteFill: {} },
  processColor: (c: any) => c,
}));

import * as React from "react";
import { act } from "react";
import TestRenderer, { ReactTestRenderer } from "react-test-renderer";
import { NativeModules } from "react-native";
import { ViroScene } from "../components/ViroScene";
import { ViroCamera } from "../components/ViroCamera";

const Light = "VRTAmbientLight" as any;
const Floor = "VRTNode" as any;
const Camera = ViroCamera as unknown as React.ComponentType<any>;

type SceneProps = {
  cameraKey?: number;
  active?: boolean;
  slot?: "middle" | "last";
  second?: { key: number; active: boolean };
};

// The report's scene: three children, with the camera second unless `slot` says last.
function Scene({ cameraKey, active = true, slot = "middle", second }: SceneProps) {
  const camera =
    cameraKey === undefined ? null : (
      <Camera
        key={`camera-${cameraKey}`}
        testTag={cameraKey}
        active={active}
        position={[0, 10, 0]}
        projection="orthographic"
        orthographicScale={2}
      />
    );
  return (
    <ViroScene>
      <Light />
      {slot === "middle" ? camera : null}
      {second ? (
        <Camera key={`camera-${second.key}`} testTag={second.key} active={second.active} />
      ) : null}
      <Floor />
      {slot === "last" ? camera : null}
    </ViroScene>
  );
}

let renderer: ReactTestRenderer | undefined;

function render(props: SceneProps) {
  act(() => {
    renderer = TestRenderer.create(<Scene {...props} />);
  });
}

function update(props: SceneProps) {
  act(() => {
    renderer!.update(<Scene {...props} />);
  });
}

function root() {
  return renderer!.root;
}

function nativeSceneCameraTag(): number | null {
  return root().findByType("VRTScene" as any).props.activeCameraTag;
}

function unmount() {
  const tree = renderer;
  renderer = undefined;
  act(() => tree?.unmount());
}

afterEach(unmount);

describe("ViroScene tells the native scene which camera is active", () => {
  it("names the active camera from the first mount, even in the middle of its siblings", () => {
    render({ cameraKey: 1 });
    expect(nativeSceneCameraTag()).toBe(1);
  });

  it("follows a camera remounted mid-list through a new key", () => {
    render({ cameraKey: 1 });
    update({ cameraKey: 2 });
    expect(nativeSceneCameraTag()).toBe(2);
  });

  it("follows a camera remounted as the last child just the same", () => {
    render({ cameraKey: 1, slot: "last" });
    update({ cameraKey: 3, slot: "last" });
    expect(nativeSceneCameraTag()).toBe(3);
  });

  it("goes back to the default camera when the active camera unmounts", () => {
    render({ cameraKey: 1 });
    update({});
    expect(nativeSceneCameraTag()).toBeNull();
  });

  it("goes back to the default camera when the camera stops being active", () => {
    render({ cameraKey: 1 });
    update({ cameraKey: 1, active: false });
    expect(nativeSceneCameraTag()).toBeNull();
    update({ cameraKey: 1, active: true });
    expect(nativeSceneCameraTag()).toBe(1);
  });

  it("switches to whichever camera becomes active", () => {
    render({ cameraKey: 1, second: { key: 2, active: false } });
    expect(nativeSceneCameraTag()).toBe(1);
    update({ cameraKey: 1, active: false, second: { key: 2, active: true } });
    expect(nativeSceneCameraTag()).toBe(2);
  });

  it("lets the last camera to become active win, and keeps it when the loser unmounts", () => {
    render({ cameraKey: 1, second: { key: 2, active: false } });
    update({ cameraKey: 1, second: { key: 2, active: true } });
    expect(nativeSceneCameraTag()).toBe(2);
    update({ second: { key: 2, active: true } });
    expect(nativeSceneCameraTag()).toBe(2);
  });

  it("ignores a camera that was never active, mounting or unmounting", () => {
    render({ cameraKey: 1, second: { key: 2, active: false } });
    update({ cameraKey: 1 });
    expect(nativeSceneCameraTag()).toBe(1);
  });

  it("no longer goes through VRTCameraModule, whose lookup is what failed", () => {
    render({ cameraKey: 1 });
    update({ cameraKey: 2 });
    update({});
    expect(NativeModules.VRTCameraModule.setSceneCamera).not.toHaveBeenCalled();
    expect(NativeModules.VRTCameraModule.removeSceneCamera).not.toHaveBeenCalled();
  });

  it("hands its cameras one context value for its whole life", () => {
    render({ cameraKey: 1 });
    const before = root().findByType(ViroCamera).instance.context;
    update({ cameraKey: 1, second: { key: 2, active: false } });
    const after = root().findAllByType(ViroCamera)[0].instance.context;
    expect(after).toBe(before);
  });

  it("does not try to re-render while it is unmounting with its camera", () => {
    render({ cameraKey: 1 });
    const scene = root().findByType(ViroScene).instance;
    const setState = jest.spyOn(scene, "setState");
    unmount();
    expect(setState).not.toHaveBeenCalled();
  });
});
