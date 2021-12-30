import * as React from "react";
import { ViroCamera } from "./ViroCamera";
export declare const ViroSceneContext: React.Context<{
    cameraDidMount: (camera: ViroCamera) => void;
    cameraWillUnmount: (camera: ViroCamera) => void;
    cameraDidUpdate: (camera: ViroCamera, active: boolean) => void;
}>;
