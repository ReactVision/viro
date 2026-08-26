export type ViroStickSide = "left" | "right";
export interface ViroControllerState {
    /** Left analog stick, each axis normalised to [-1, 1]. */
    left: {
        x: number;
        y: number;
    };
    /** Right analog stick, each axis normalised to [-1, 1]. */
    right: {
        x: number;
        y: number;
    };
    /** Currently-pressed buttons, keyed by button name (e.g. "A"). */
    buttons: Record<string, boolean>;
}
type Listener = (state: ViroControllerState) => void;
/** Read-only snapshot of a controller's current aggregated state. */
export declare function peek(id: string): ViroControllerState;
/** Write a stick deflection (x/y in [-1, 1]) for one controller. */
export declare function setStick(id: string, side: ViroStickSide, x: number, y: number): void;
/** Write a button press/release for one controller. */
export declare function setButton(id: string, name: string, pressed: boolean): void;
/** Subscribe to a controller's state changes. Returns an unsubscribe fn. */
export declare function subscribe(id: string, cb: Listener): () => void;
/**
 * React hook returning the live aggregated state of a virtual controller.
 * Re-renders whenever any input source (joystick, button, …) targeting the same
 * `controllerId` updates. This is the web read-path equivalent of native code
 * peeking VROVirtualControllerRegistry each frame.
 */
export declare function useVirtualController(id: string): ViroControllerState;
export {};
