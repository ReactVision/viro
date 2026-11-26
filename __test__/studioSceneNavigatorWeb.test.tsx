/**
 * The web Studio host renders its scene inside ViroARSceneNavigator.web, which
 * owns the motion-permission flow. A callback the host passes has to reach it,
 * or a Studio web host never hears that AR cannot start.
 */
const arNavigatorProps: any[] = [];
const threeDNavigatorProps: any[] = [];

jest.mock("../components/AR/ViroARSceneNavigator.web", () => ({
  ViroARSceneNavigator: (props: any) => {
    arNavigatorProps.push(props);
    return null;
  },
}));
jest.mock("../components/Viro3DSceneNavigator.web", () => ({
  Viro3DSceneNavigator: (props: any) => {
    threeDNavigatorProps.push(props);
    return null;
  },
}));
jest.mock("../components/Studio/StudioARScene.web", () => ({
  StudioARScene: () => null,
}));
jest.mock("../components/Studio/StudioPlacementIndicator.web", () => ({
  StudioPlacementIndicator: () => null,
}));
jest.mock("../components/Studio/StudioRecordingIndicator.web", () => ({
  StudioRecordingIndicator: () => null,
}));
jest.mock("../components/Studio/StudioColocationIndicator.web", () => ({
  StudioColocationIndicator: () => null,
}));
jest.mock("../components/Studio/StudioWebAlertOverlay", () => ({
  StudioWebAlertOverlay: () => null,
}));

import * as React from "react";
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TestRenderer from "react-test-renderer";
import {
  StudioSceneNavigator,
  type StudioSceneNavigatorWebHandle,
} from "../components/Studio/StudioSceneNavigator.web";
import type { StudioVpsStateEvent } from "../components/Studio/domain/vps";
import type { StudioSceneResponse } from "../components/Studio/types";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function scene(planeDetection: string): StudioSceneResponse {
  return {
    scene: { id: "scene-1", plane_detection: planeDetection },
    assets: [],
  } as unknown as StudioSceneResponse;
}

beforeEach(() => {
  arNavigatorProps.length = 0;
  threeDNavigatorProps.length = 0;
});

describe("StudioSceneNavigator (web) and onMotionUnavailable", () => {
  it("forwards the callback to the AR navigator", () => {
    const onMotionUnavailable = jest.fn();
    renderToStaticMarkup(
      <StudioSceneNavigator
        sceneData={scene("AUTOMATIC")}
        onMotionUnavailable={onMotionUnavailable}
      />
    );
    expect(arNavigatorProps).toHaveLength(1);
    arNavigatorProps[0].onMotionUnavailable("denied");
    expect(onMotionUnavailable).toHaveBeenCalledWith("denied");
  });

  it("passes nothing when the host gave no callback", () => {
    renderToStaticMarkup(<StudioSceneNavigator sceneData={scene("MANUAL")} />);
    expect(arNavigatorProps).toHaveLength(1);
    expect(arNavigatorProps[0].onMotionUnavailable).toBeUndefined();
  });

  it("does not mount the AR navigator for a 3D scene", () => {
    renderToStaticMarkup(
      <StudioSceneNavigator
        sceneData={scene("NONE")}
        onMotionUnavailable={jest.fn()}
      />
    );
    expect(arNavigatorProps).toHaveLength(0);
    expect(threeDNavigatorProps).toHaveLength(1);
  });
});

describe("StudioSceneNavigator (web) and a renderer that cannot start", () => {
  it.each([
    ["AUTOMATIC", arNavigatorProps],
    ["NONE", threeDNavigatorProps],
  ])("reports it through onError and renderError (%s)", (planeDetection, navigatorProps) => {
    const onError = jest.fn();
    const renderError = jest.fn((e: Error) => <>{e.message}</>);
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <StudioSceneNavigator
          sceneData={scene(planeDetection)}
          onError={onError}
          renderError={renderError}
        />
      );
    });
    const err = Object.assign(new Error("no WebGL2"), {
      name: "ViroWebGLUnavailableError",
      reason: "unsupported",
    });
    act(() => navigatorProps[navigatorProps.length - 1].onWebRendererError(err));

    expect(onError).toHaveBeenCalledWith(err);
    expect(renderError).toHaveBeenLastCalledWith(err, expect.any(Function));
    expect(tree!.toJSON()).toBe("no WebGL2");
    act(() => tree.unmount());
  });
});

describe("StudioSceneNavigator (web) and onVpsStateChange", () => {
  it("reports a scene bound to a VPS location as unsupported, and idle when it is left", () => {
    const events: StudioVpsStateEvent[] = [];
    const bound = {
      scene: {
        id: "scene-1",
        plane_detection: "NONE",
        vps_location_id: "loc-1",
      },
      assets: [],
      vps: { endpoint: "https://vps.example.test" },
    } as unknown as StudioSceneResponse;
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <StudioSceneNavigator
          sceneData={bound}
          onVpsStateChange={(e) => events.push(e)}
        />
      );
    });
    expect(events).toEqual([
      {
        sceneId: "scene-1",
        locationId: "loc-1",
        state: "unsupported",
        error: expect.objectContaining({ code: "UNSUPPORTED", status: null }),
      },
    ]);

    act(() => tree.unmount());
    expect(events.map((e) => e.state)).toEqual(["unsupported", "idle"]);
  });

  it("has no VPS tracking to restart", () => {
    const ref = React.createRef<StudioSceneNavigatorWebHandle>();
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <StudioSceneNavigator
          ref={ref}
          sceneData={
            {
              scene: { id: "scene-1", vps_location_id: "loc-1" },
              assets: [],
            } as unknown as StudioSceneResponse
          }
        />
      );
    });
    expect(ref.current!.retryVps()).toBe(false);
    act(() => tree.unmount());
  });

  it("reports nothing for an unbound scene", () => {
    const onVpsStateChange = jest.fn();
    let tree: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <StudioSceneNavigator
          sceneData={scene("NONE")}
          onVpsStateChange={onVpsStateChange}
        />
      );
    });
    act(() => tree.unmount());
    expect(onVpsStateChange).not.toHaveBeenCalled();
  });
});

describe("StudioSceneNavigator (web) and onSceneChange", () => {
  it("fires once a NAVIGATION target has loaded", async () => {
    const next = {
      scene: { id: "scene-2", name: "Two", plane_detection: "AUTOMATIC" },
      assets: [],
    } as unknown as StudioSceneResponse;
    const loadScene = jest.fn(async () => next);
    const onSceneChange = jest.fn();
    act(() => {
      TestRenderer.create(
        <StudioSceneNavigator
          sceneData={scene("AUTOMATIC")}
          loadScene={loadScene}
          onSceneChange={onSceneChange}
        />
      );
    });

    const { navigate } = arNavigatorProps[arNavigatorProps.length - 1].viroAppProps;
    await act(async () => navigate("scene-2"));

    expect(loadScene).toHaveBeenCalledWith("scene-2");
    expect(onSceneChange).toHaveBeenCalledTimes(1);
    expect(onSceneChange).toHaveBeenCalledWith("scene-2", "Two");
  });
});

describe("StudioSceneNavigator (web) and tap-to-place", () => {
  it("leaves the AR start button uncovered until the session has started", () => {
    const placed = {
      id: "cube",
      name: "Cube",
      asset_type_name: "3D-MODEL",
      tap_to_place: true,
      tap_to_place_order: 0,
      trigger_image_url: null,
    };
    const data = { scene: { id: "scene-1", plane_detection: "NONE" }, assets: [placed] } as unknown as StudioSceneResponse;
    const onSessionReady = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <StudioSceneNavigator sceneData={data} mode="ar" onSessionReady={onSessionReady} />
      );
    });
    const latest = () => arNavigatorProps[arNavigatorProps.length - 1];
    act(() => latest().viroAppProps.placementStore.seed([placed]));
    const tapSurfaces = () => tree.root.findAll((n) => n.type === "div" && !!n.props.onPointerUp);
    expect(tapSurfaces()).toHaveLength(0);

    const session = {};
    act(() => latest().onSessionReady(session));
    expect(tapSurfaces()).toHaveLength(1);
    expect(onSessionReady).toHaveBeenCalledWith(session);
    act(() => tree.unmount());
  });
});
