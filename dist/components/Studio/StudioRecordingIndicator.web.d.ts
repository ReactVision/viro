/**
 * Web host for StudioRecordingIndicator. See the note in
 * StudioPlacementIndicator.web.tsx for why this is DOM rather than
 * react-native-web.
 *
 * One difference worth stating rather than leaving to be discovered: the native
 * comment says this pill is *not* captured into the recording, because there it
 * is a react-native view sitting over the AR surface. That still holds on web —
 * it is a DOM sibling of the canvas, and neither the WebGL capture nor a
 * canvas-based recorder sees it.
 */
import * as React from "react";
export declare function StudioRecordingIndicator(): React.JSX.Element | null;
