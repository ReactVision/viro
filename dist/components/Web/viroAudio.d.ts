/**
 * Shared Web Audio context for spatial sound, and the listener that follows the
 * camera.
 *
 * Lazily created (browsers require a user gesture to resume it; callers should
 * catch play() rejections).
 */
import { type Quat, type Vec3 } from "./viroMath";
export declare function getAudioContext(): AudioContext;
/** Anything that can say where the camera is. The AR session is the implementor. */
export interface ViroAudioListenerSource {
    readonly cameraPose: {
        position: Vec3;
        quaternion: Quat;
    };
}
/**
 * Keep the Web Audio listener on the camera for as long as at least one caller
 * wants it there.
 *
 * One loop no matter how many sounds are playing: the listener is a property of
 * the context, not of any sound, so a loop per sound would write the same values
 * several times a frame. Returns the release for this caller; the loop stops
 * when the last one releases.
 */
export declare function trackAudioListener(source: ViroAudioListenerSource): () => void;
