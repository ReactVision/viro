/**
 * Web implementation of ViroGameLoop — drives per-frame callbacks off
 * requestAnimationFrame. `onUpdate`/`onLateUpdate` fire every frame with
 * `{ dt, elapsed }` (seconds); `onFixedUpdate` fires at a fixed rate (`fixedHz`)
 * with an accumulator. The loop stops on unmount and pauses when `paused`.
 */
import * as React from "react";
import { useEffect, useRef } from "react";

type UpdateEvent = { dt: number; elapsed: number };

type Props = {
  fixedHz?: number;
  paused?: boolean;
  onUpdate?: (event: UpdateEvent) => void;
  onLateUpdate?: (event: UpdateEvent) => void;
  onFixedUpdate?: (event: { dt: number }) => void;
  [key: string]: any;
};

export function ViroGameLoop(props: Props) {
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const start = last;
    let acc = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const p = propsRef.current;
      const dt = (now - last) / 1000;
      last = now;
      if (p.paused) return;

      const elapsed = (now - start) / 1000;
      p.onUpdate?.({ dt, elapsed });

      const hz = p.fixedHz ?? 0;
      if (hz > 0 && p.onFixedUpdate) {
        const step = 1 / hz;
        acc += dt;
        // Clamp to avoid a spiral of death after a long stall.
        if (acc > step * 5) acc = step * 5;
        while (acc >= step) {
          p.onFixedUpdate({ dt: step });
          acc -= step;
        }
      }

      p.onLateUpdate?.({ dt, elapsed });
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return null;
}
