import * as React from "react";
import { ViroCamera } from "./ViroCamera";
import { ViroOrbitCamera } from "./ViroOrbitCamera";

export const ViroSceneContext = React.createContext({
  cameraDidMount: (camera: ViroCamera | ViroOrbitCamera) => {
    console.log("ViroSceneContext.cameraDidMount: " + camera);
  },
  cameraWillUnmount: (camera: ViroCamera | ViroOrbitCamera) => {
    console.log("ViroSceneContext.cameraWillUnmount: " + camera);
  },
  cameraDidUpdate: (camera: ViroCamera | ViroOrbitCamera, active: boolean) => {
    console.log(
      "ViroSceneContext.cameraDidUpdate: " + camera + " active: " + active
    );
  },
});
