import * as React from "react";
/**
 * Live "recording" overlay for the RECORD_VIDEO toggle: a red REC pill + elapsed
 * timer shown while a recording is in progress. Because RECORD_VIDEO is a toggle,
 * this doubles as the state cue for what the next trigger does (stop vs start).
 *
 * Rendered by StudioSceneNavigator as a sibling over the AR view. Being a RN
 * view it is NOT captured into the recording (the GL recorder only captures the
 * scene, same reason the watermark is baked in separately), so it is user-only.
 */
export declare function RecordingIndicator(): React.JSX.Element | null;
