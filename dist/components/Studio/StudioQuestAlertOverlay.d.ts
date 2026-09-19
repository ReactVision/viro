import * as React from "react";
import { CameraPose } from "./domain/questHeadLockedTransform";
type Props = {
    /** Latest cached camera pose (throttled — see StudioARScene). Null before
     * the first onCameraTransformUpdate fires. */
    cameraPose: CameraPose | null;
};
/**
 * Quest-only in-scene replacement for Alert.alert (invisible in the VR
 * compositor). Renders questAlertStore's active message as a head-locked
 * panel; dismiss is a controller click anywhere on the panel, mirroring how
 * tapping "OK" dismisses the native dialog on phones.
 */
export declare function StudioQuestAlertOverlay({ cameraPose }: Props): React.JSX.Element | null;
export {};
