import { ViroClickState } from "../Types/ViroEvents";
import type { Viro3DPoint } from "../Types/ViroUtils";
/**
 * Aggregate `onClickState` "is being pressed" state across all input sources.
 *
 * Mirror of `useAnySourceHover` for clicks. Tracks per-source `CLICK_DOWN` /
 * `CLICK_UP` events from any input source (right + left controllers / hands)
 * and returns a single aggregated boolean — `true` whenever **any** source
 * is currently holding the trigger / pinch on this node.
 *
 * The fully-completed `CLICKED` event is intentionally ignored here: it is
 * informational ("a complete click happened") and shouldn't toggle the
 * held-state. Apps that need the click event itself can use the regular
 * `onClick` prop — those callbacks already pass the `source`.
 *
 * Usage:
 * ```tsx
 * function MyButton() {
 *   const [pressed, onClickState] = useAnySourcePressed();
 *   return (
 *     <ViroNode onClickState={onClickState} onClick={...}>
 *       <ViroQuad
 *         scale={pressed ? [0.95, 0.95, 0.95] : [1, 1, 1]}
 *         materials={[pressed ? "btnPressed" : "btnIdle"]}
 *       />
 *     </ViroNode>
 *   );
 * }
 * ```
 *
 * Internally deduplicates per source so a sequence of `(CLICK_DOWN, src=A)`
 * events from the same source produces at most one re-render.
 */
export declare function useAnySourcePressed(): readonly [
    boolean,
    (clickState: ViroClickState, position: Viro3DPoint, source: unknown) => void
];
