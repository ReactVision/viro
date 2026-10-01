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

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StudioSceneNavigator } from "../components/Studio/StudioSceneNavigator.web";
import type { StudioSceneResponse } from "../components/Studio/types";

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
