/**
 * useGameLoop — convenience hook that wraps <ViroGameLoop />.
 *
 * NOTE: This hook does NOT imperatively mount a component. It is designed to
 * be used alongside a <ViroGameLoop> component in the scene. The component
 * fires the events; the hook subscribes to them via a shared ref pattern.
 *
 * For the most common case — one game loop per scene — use <ViroGameLoop>
 * directly with onUpdate/onFixedUpdate props. The hook is provided as
 * syntactic sugar for cases where the callback needs to live deep in the tree.
 *
 * Copyright © 2026 ReactVision. All rights reserved.
 */
import type { ViroGameLoopUpdateEvent, ViroGameLoopFixedEvent } from "../ViroGameLoop";
export type UseGameLoopOptions = {
    /** Fixed simulation frequency in Hz. Requires a ViroGameLoop with matching fixedHz. */
    fixedHz?: number;
};
/**
 * Subscribe to the variable-step update from the nearest <ViroGameLoop>.
 *
 * The callback is always current (uses a ref internally) so it is safe to
 * reference component state without adding it to a dependency array.
 */
export declare function useGameLoop(callback: (event: ViroGameLoopUpdateEvent) => void, _options?: UseGameLoopOptions): (event: ViroGameLoopUpdateEvent) => void;
/**
 * Subscribe to the late-update (post-physics) callback.
 */
export declare function useLateUpdate(callback: (event: ViroGameLoopUpdateEvent) => void): (event: ViroGameLoopUpdateEvent) => void;
/**
 * Subscribe to the fixed-step callback.
 * Requires a <ViroGameLoop fixedHz={N}> in the scene.
 */
export declare function useFixedUpdate(callback: (event: ViroGameLoopFixedEvent) => void): (event: ViroGameLoopFixedEvent) => void;
