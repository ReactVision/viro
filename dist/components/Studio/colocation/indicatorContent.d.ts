import type { StudioColocationState } from "./types";
/** Host: the room exists and waits for the scene's origin to be picked. */
export type StudioColocationOriginPrompt = {
    joinCode: string | null;
    /** MANUAL: a tap picks the surface; AUTOMATIC takes the first one found. */
    tap: boolean;
};
export type StudioColocationIndicatorContent = {
    title: string;
    detail: string | null;
    /** The join code to read out, on the host's pill once the room exists. */
    code: string | null;
    /** Host scanning: the Done button, enabled once the scan covers enough. */
    done: {
        enabled: boolean;
    } | null;
    tone: "progress" | "live" | "error";
};
/** A headset hosts a Meta anchor with no scan, and joins without walking a scanned area. */
export type StudioColocationDevice = "phone" | "headset";
/** What both indicator variants show for a state; null shows nothing. */
export declare function studioColocationIndicatorContent(state: StudioColocationState, originPrompt?: StudioColocationOriginPrompt | null, device?: StudioColocationDevice): StudioColocationIndicatorContent | null;
