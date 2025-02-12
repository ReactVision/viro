import * as React from "react";
import { ViroCamera } from "./ViroCamera";
import { ViroOrbitCamera } from "./ViroOrbitCamera";
export declare const ViroSceneContext: React.Context<{
    cameraDidMount: (camera: ViroCamera | ViroOrbitCamera) => void;
    cameraWillUnmount: (camera: ViroCamera | ViroOrbitCamera) => void;
    cameraDidUpdate: (camera: ViroCamera | ViroOrbitCamera, active: boolean) => void;
}>;
