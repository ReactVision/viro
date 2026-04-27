import type { Viro3DPoint } from "../Types/ViroUtils";
/**
 * Aggregate `onHover` state across all input sources.
 *
 * On Quest (and any other backend that supports multiple simultaneous
 * pointers — e.g. left + right controllers, or controller + tracked hand),
 * Viro fires the node's `onHover` callback **per source**. A second pointer
 * sweeping over an already-hovered node would otherwise produce spurious
 * enter/exit toggles in JS even though the visual hover should remain "on".
 *
 * This hook tracks each source ID independently and exposes a single
 * aggregated boolean — `true` whenever **any** source is hovering the node.
 * Apps that don't care about per-source distinction (the common case for
 * UI buttons) can just consume the boolean.
 *
 * Usage:
 * ```tsx
 * function MyButton() {
 *   const [hovered, onHover] = useAnySourceHover();
 *   return (
 *     <ViroNode onHover={onHover}>
 *       <ViroQuad materials={[hovered ? "btnHover" : "btnIdle"]} ... />
 *     </ViroNode>
 *   );
 * }
 * ```
 *
 * The handler signature matches Viro's `onHover` prop directly — pass it as
 * `onHover={onHover}` with no wrapper. Internally the hook deduplicates per
 * source so a sequence of `(true, …, src=A)` events from the same source
 * produces at most one re-render.
 */
export declare function useAnySourceHover(): readonly [
    boolean,
    (isHovering: boolean, position: Viro3DPoint, source: unknown) => void
];
