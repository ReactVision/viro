import * as React from "react";
import { StudioSoundManager } from "./soundManager";
/**
 * Renders every actively-playing sound from the manager, re-painting the whole
 * list on any change (like the reactive variable-text nodes). Non-looping sounds
 * remove themselves on finish; any sound removes itself on error so a clip that
 * fails to load releases a waiting step instead of stalling the sequence.
 */
export declare const StudioSounds: React.FC<{
    manager: StudioSoundManager;
}>;
