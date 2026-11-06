import * as React from "react";
import type {
  ViroSceneCamera,
  ViroSceneCameraCallbacks,
} from "./Utilities/ViroActiveCameraTracker";

export const ViroSceneContext = React.createContext<ViroSceneCameraCallbacks>({
  cameraDidMount: (_camera: ViroSceneCamera) => {},
  cameraWillUnmount: (_camera: ViroSceneCamera) => {},
  cameraDidUpdate: (_camera: ViroSceneCamera, _active: boolean) => {},
});
