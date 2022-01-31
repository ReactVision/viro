import * as React from "react";
import { ViroCamera } from "./ViroCamera";

export const ViroSceneContext = React.createContext({
  cameraDidMount: (camera: ViroCamera) => {
    console.log("ViroSceneContext.cameraDidMount: " + camera);
  },
  cameraWillUnmount: (camera: ViroCamera) => {
    console.log("ViroSceneContext.cameraWillUnmount: " + camera);
  },
  cameraDidUpdate: (camera: ViroCamera, active: boolean) => {
    console.log(
      "ViroSceneContext.cameraDidUpdate: " + camera + " active: " + active
    );
  },
});
