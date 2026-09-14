/**
 * Shared Web Audio context for spatial sound, and the listener that follows the
 * camera.
 *
 * Lazily created (browsers require a user gesture to resume it; callers should
 * catch play() rejections).
 */
export declare function getAudioContext(): AudioContext;
type Vec3 = [number, number, number];
type Quat = [number, number, number, number];
/** Anything that can say where the camera is. The AR session is the implementor. */
export interface ViroAudioListenerSource {
    readonly cameraPose: {
        position: Vec3;
        quaternion: Quat;
    };
}
/**
 * Rotate a vector by a quaternion: v + 2w(q × v) + 2(q × (q × v)).
 *
 * Exported for its own test — a sign error here points every sound at the wrong
 * side of the listener, which is hard to hear and easy to write.
 */
export declare function rotateByQuaternion(q: Quat, v: Vec3): Vec3;
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
export {};
