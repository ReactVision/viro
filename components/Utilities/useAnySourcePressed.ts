import { useCallback, useRef, useState } from "react";

import {
  ViroClickState,
  ViroClickStateTypes,
} from "../Types/ViroEvents";
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
export function useAnySourcePressed(): readonly [
  boolean,
  (clickState: ViroClickState, position: Viro3DPoint, source: unknown) => void,
] {
  const sourcesRef = useRef<Record<string, boolean>>({});
  const [pressed, setPressed] = useState(false);

  const onClickState = useCallback(
    (clickState: ViroClickState, _position: Viro3DPoint, source: unknown) => {
      let next: boolean;
      if (clickState === ViroClickStateTypes.CLICK_DOWN) {
        next = true;
      } else if (clickState === ViroClickStateTypes.CLICK_UP) {
        next = false;
      } else {
        // CLICKED is fired between DOWN and UP for completed clicks —
        // doesn't change held state, ignore.
        return;
      }

      const key = String(source ?? "default");
      if (sourcesRef.current[key] === next) return;
      sourcesRef.current[key] = next;
      const any = Object.values(sourcesRef.current).some(Boolean);
      setPressed(any);
    },
    []
  );

  return [pressed, onClickState] as const;
}
