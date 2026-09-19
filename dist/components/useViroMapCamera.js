"use strict";
/**
 * useViroMapCamera — pan, zoom and orbit for a non-AR map or floor-plan view.
 *
 * Every customer building a bird's-eye viewer reinvents this, and most reach for
 * the object-drag API first: `dragType="FixedDistance"` is *defined* to scale
 * with camera distance, so a drag that feels right up close flies across the
 * scene when zoomed out. That is an object-manipulation API being used to move a
 * camera. This hook moves the camera instead.
 *
 * The camera is described the way a map is: a `target` point on the ground, a
 * `yaw` around it, a `pitch` down toward it, and a zoom. Position and rotation
 * are derived from those, never stored, so the state can never disagree with
 * itself.
 *
 * State lives in a ref and reaches the scene through ViroGameLoopUtils, so a
 * gesture never triggers a React render. Only `orthographicScale` is a prop,
 * because it has no reconciler-free path.
 *
 * Copyright © 2026 ReactVision
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.viroMapCameraTransform = viroMapCameraTransform;
exports.useViroMapCamera = useViroMapCamera;
const react_1 = require("react");
const react_native_1 = require("react-native");
const ViroGameLoopUtils_1 = require("./ViroGameLoopUtils");
const DEG = Math.PI / 180;
const DEFAULTS = {
    target: [0, 0, 0],
    distance: 12,
    yaw: 0,
    pitch: 90,
    orthographicScale: 10,
};
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** Camera position for a target/distance/yaw/pitch, and the Euler rotation that looks back at it. */
function viroMapCameraTransform(s) {
    const y = s.yaw * DEG;
    const p = s.pitch * DEG;
    const horizontal = Math.cos(p) * s.distance;
    return {
        position: [
            s.target[0] + horizontal * Math.sin(y),
            s.target[1] + Math.sin(p) * s.distance,
            s.target[2] + horizontal * Math.cos(y),
        ],
        rotation: [-s.pitch, s.yaw, 0],
    };
}
function useViroMapCamera(options = {}) {
    const { orthographic = false, bounds, distanceRange = [2, 200], scaleRange = [1, 200], pitchRange = [15, 90], fieldOfView = 45, enabled = true, orbitWithTwoFingers = true, onChange, } = options;
    const nodeRef = (0, react_1.useRef)(null);
    const state = (0, react_1.useRef)({ ...DEFAULTS, ...options.initial });
    const viewport = (0, react_1.useRef)({ width: 0, height: 0 });
    const flight = (0, react_1.useRef)(null);
    // The only value that cannot bypass the reconciler, so the only one held as
    // React state. Under perspective it never changes.
    const [scale, setScale] = (0, react_1.useState)(state.current.orthographicScale);
    const commit = (0, react_1.useCallback)(() => {
        const s = state.current;
        if (bounds) {
            s.target[0] = clamp(s.target[0], bounds.min[0], bounds.max[0]);
            s.target[2] = clamp(s.target[2], bounds.min[1], bounds.max[1]);
        }
        s.pitch = clamp(s.pitch, pitchRange[0], pitchRange[1]);
        s.distance = clamp(s.distance, distanceRange[0], distanceRange[1]);
        s.orthographicScale = clamp(s.orthographicScale, scaleRange[0], scaleRange[1]);
        const { position, rotation } = viroMapCameraTransform(s);
        ViroGameLoopUtils_1.ViroGameLoopUtils.setPosition(nodeRef, position);
        ViroGameLoopUtils_1.ViroGameLoopUtils.setRotation(nodeRef, rotation);
        if (orthographic) {
            setScale(s.orthographicScale);
        }
        onChange?.(s);
    }, [bounds, pitchRange, distanceRange, scaleRange, orthographic, onChange]);
    /**
     * World units covered by one pixel of vertical screen. Under orthographic this
     * is exact and independent of distance; under perspective it is the size of
     * the view where it crosses the ground under the target.
     */
    const unitsPerPixel = (0, react_1.useCallback)(() => {
        const h = viewport.current.height;
        if (!h)
            return 0;
        const s = state.current;
        const worldHeight = orthographic
            ? s.orthographicScale
            : 2 * s.distance * Math.tan((fieldOfView * DEG) / 2);
        return worldHeight / h;
    }, [orthographic, fieldOfView]);
    const controls = (0, react_1.useMemo)(() => ({
        /** Drag the map by a screen delta in pixels. */
        panByPixels(dx, dy) {
            const upp = unitsPerPixel();
            if (!upp)
                return;
            const s = state.current;
            const y = s.yaw * DEG;
            // Screen-right in world terms, and screen-up projected onto the ground.
            // The target moves opposite the finger, so the map follows it.
            const rightX = Math.cos(y);
            const rightZ = -Math.sin(y);
            const fwdX = Math.sin(y);
            const fwdZ = Math.cos(y);
            // A shallow pitch stretches vertical drags across the ground; dividing by
            // sin(pitch) keeps the point under the finger under the finger.
            const vertical = dy * upp / Math.max(Math.sin(s.pitch * DEG), 0.2);
            s.target[0] -= rightX * dx * upp + fwdX * vertical;
            s.target[2] -= rightZ * dx * upp + fwdZ * vertical;
            commit();
        },
        /** factor > 1 zooms out, < 1 zooms in. */
        zoomBy(factor) {
            const s = state.current;
            if (orthographic)
                s.orthographicScale *= factor;
            else
                s.distance *= factor;
            commit();
        },
        orbitBy(deltaYaw, deltaPitch) {
            const s = state.current;
            s.yaw += deltaYaw;
            s.pitch += deltaPitch;
            commit();
        },
        /** Jump straight to a state, cancelling any flight in progress. */
        setState(next) {
            if (flight.current != null) {
                cancelAnimationFrame(flight.current);
                flight.current = null;
            }
            Object.assign(state.current, next);
            if (next.target)
                state.current.target = [...next.target];
            commit();
        },
        /** Ease to a state over `duration` ms. Resolves when it arrives. */
        flyTo(next, duration = 600) {
            if (flight.current != null)
                cancelAnimationFrame(flight.current);
            const from = {
                ...state.current,
                target: [...state.current.target],
            };
            const to = {
                ...from,
                ...next,
                target: (next.target ?? from.target),
            };
            // Take the short way round, so 350° → 10° turns 20° rather than 340°.
            let dYaw = ((to.yaw - from.yaw + 540) % 360) - 180;
            const start = Date.now();
            return new Promise((resolve) => {
                const step = () => {
                    const t = duration <= 0 ? 1 : clamp((Date.now() - start) / duration, 0, 1);
                    const e = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t); // ease in-out
                    const s = state.current;
                    s.target = [
                        from.target[0] + (to.target[0] - from.target[0]) * e,
                        from.target[1] + (to.target[1] - from.target[1]) * e,
                        from.target[2] + (to.target[2] - from.target[2]) * e,
                    ];
                    s.distance = from.distance + (to.distance - from.distance) * e;
                    s.pitch = from.pitch + (to.pitch - from.pitch) * e;
                    s.yaw = from.yaw + dYaw * e;
                    s.orthographicScale =
                        from.orthographicScale + (to.orthographicScale - from.orthographicScale) * e;
                    commit();
                    if (t < 1) {
                        flight.current = requestAnimationFrame(step);
                    }
                    else {
                        flight.current = null;
                        resolve();
                    }
                };
                step();
            });
        },
        get() {
            return state.current;
        },
    }), [commit, unitsPerPixel, orthographic]);
    /**
     * Spread onto the View that overlays the scene. Kept separate from the hook's
     * own state so an app whose touches never reach React Native — see the
     * PanResponder note in the docs — can drive `controls` from its own input and
     * lose nothing.
     */
    const panResponder = (0, react_1.useMemo)(() => {
        // gesture.dx/dy are cumulative over the gesture, so a per-move delta needs
        // the previous values. Pinch distance is tracked the same way.
        let lastDx = 0;
        let lastDy = 0;
        let lastPinch = 0;
        const reset = () => {
            lastDx = 0;
            lastDy = 0;
            lastPinch = 0;
        };
        return react_native_1.PanResponder.create({
            onStartShouldSetPanResponder: () => enabled,
            onMoveShouldSetPanResponder: () => enabled,
            onPanResponderGrant: reset,
            onPanResponderMove: (evt, gesture) => {
                if (!enabled)
                    return;
                const touches = evt.nativeEvent.touches;
                if (touches.length >= 2) {
                    const [a, b] = touches;
                    const pinch = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
                    if (lastPinch > 0 && pinch > 0) {
                        controls.zoomBy(lastPinch / pinch);
                    }
                    lastPinch = pinch;
                    if (orbitWithTwoFingers) {
                        controls.orbitBy((gesture.dx - lastDx) * 0.4, (gesture.dy - lastDy) * 0.2);
                    }
                    lastDx = gesture.dx;
                    lastDy = gesture.dy;
                    return;
                }
                // Back to one finger: drop the pinch baseline so the next two-finger
                // gesture does not read the gap as an instant zoom.
                lastPinch = 0;
                controls.panByPixels(gesture.dx - lastDx, gesture.dy - lastDy);
                lastDx = gesture.dx;
                lastDy = gesture.dy;
            },
            onPanResponderRelease: reset,
            onPanResponderTerminate: reset,
        });
    }, [enabled, orbitWithTwoFingers, controls]);
    const onLayout = (0, react_1.useCallback)((e) => {
        viewport.current = {
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
        };
    }, []);
    const initialTransform = (0, react_1.useMemo)(() => viroMapCameraTransform(state.current), 
    // Only for the first render; every later update goes through commit().
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);
    return {
        /** Attach to the ViroNode that wraps the ViroCamera. */
        nodeRef: nodeRef,
        /** Spread onto that ViroNode. */
        nodeProps: {
            position: initialTransform.position,
            rotation: initialTransform.rotation,
        },
        /** Spread onto the ViroCamera. */
        cameraProps: {
            active: true,
            fieldOfView,
            projection: (orthographic ? "orthographic" : "perspective"),
            orthographicScale: scale,
        },
        /** Spread onto the overlay View, together with onLayout. */
        panHandlers: panResponder.panHandlers,
        onLayout,
        controls,
    };
}
