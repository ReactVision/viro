"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViroGameLoop = ViroGameLoop;
const react_1 = require("react");
function ViroGameLoop(props) {
    const propsRef = (0, react_1.useRef)(props);
    propsRef.current = props;
    (0, react_1.useEffect)(() => {
        let raf = 0;
        let last = performance.now();
        const start = last;
        let acc = 0;
        const tick = (now) => {
            raf = requestAnimationFrame(tick);
            const p = propsRef.current;
            const dt = (now - last) / 1000;
            last = now;
            if (p.paused)
                return;
            const elapsed = (now - start) / 1000;
            p.onUpdate?.({ dt, elapsed });
            const hz = p.fixedHz ?? 0;
            if (hz > 0 && p.onFixedUpdate) {
                const step = 1 / hz;
                acc += dt;
                // Clamp to avoid a spiral of death after a long stall.
                if (acc > step * 5)
                    acc = step * 5;
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
