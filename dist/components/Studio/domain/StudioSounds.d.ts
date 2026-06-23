import * as React from "react";
import { StudioSoundManager } from "./soundManager";
/**
 * Renders every actively-playing sound from the manager. Subscribes to the
 * manager and force-renders on change (the whole list re-paints, like the
 * reactive variable-text nodes). A positioned PLAY uses ViroSpatialSound;
 * otherwise a non-spatial ViroSound. Non-looping sounds remove themselves
 * from the manager on finish.
 */
export declare const StudioSounds: React.FC<{
    manager: StudioSoundManager;
}>;
