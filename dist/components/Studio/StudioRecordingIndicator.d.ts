import * as React from "react";
/**
 * REC pill for the RECORD_VIDEO toggle: a red dot + elapsed timer, shown only
 * while recording. Position-agnostic (it lays out no absolute position of its
 * own) so the embedding host controls placement.
 *
 * StudioSceneNavigator renders this by default (see its `recordingIndicator`
 * prop). Hosts with their own top-of-screen chrome can set that prop to false
 * and render this where it fits, or build a custom UI from useStudioRecording().
 * As a RN view over the AR surface it is NOT captured into the recording.
 */
export declare function StudioRecordingIndicator(): React.JSX.Element | null;
