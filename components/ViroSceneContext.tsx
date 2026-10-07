import * as React from "react";
import type {
  ViroSceneCamera,
  ViroSceneCameraCallbacks,
} from "./Utilities/ViroActiveCameraTracker";

export const ViroSceneContext = React.createContext<ViroSceneCameraCallbacks>({
  cameraDidMount: (camera: ViroSceneCamera) => {
    console.log("ViroSceneContext.cameraDidMount: " + camera);
  },
  cameraWillUnmount: (camera: ViroSceneCamera) => {
    console.log("ViroSceneContext.cameraWillUnmount: " + camera);
  },
  cameraDidUpdate: (camera: ViroSceneCamera, active: boolean) => {
    console.log(
      "ViroSceneContext.cameraDidUpdate: " + camera + " active: " + active
    );
  },
});
