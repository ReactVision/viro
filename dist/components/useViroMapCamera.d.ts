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
import { type LayoutChangeEvent } from "react-native";
import type React from "react";
type Vec3 = [number, number, number];
export type ViroMapCameraState = {
    /** Point on the ground the camera looks at. */
    target: Vec3;
    /** Metres from target to camera. Frames the view only under perspective. */
    distance: number;
    /** Degrees around Y. 0 looks along -Z. */
    yaw: number;
    /** Degrees down from the horizon. 90 is straight down. */
    pitch: number;
    /** Full vertical world height in view. Frames the view under orthographic. */
    orthographicScale: number;
};
export type ViroMapCameraOptions = {
    initial?: Partial<ViroMapCameraState>;
    /**
     * Orthographic changes what zoom means. Moving an orthographic camera does not
     * change how large anything appears — only `orthographicScale` does — so zoom
     * drives the scale here and the distance there.
     */
    orthographic?: boolean;
    /** Clamps the target to a rectangle on the ground, as [minX, minZ]/[maxX, maxZ]. */
    bounds?: {
        min: [number, number];
        max: [number, number];
    };
    distanceRange?: [number, number];
    scaleRange?: [number, number];
    /** Degrees. Defaults to [15, 90] — below 15 a floor plan degenerates into an edge. */
    pitchRange?: [number, number];
    /** Vertical field of view in degrees, used to size a perspective drag. */
    fieldOfView?: number;
    /** Set false to freeze input without unmounting. */
    enabled?: boolean;
    /** Two-finger drag orbits instead of panning. Default true. */
    orbitWithTwoFingers?: boolean;
    onChange?: (state: Readonly<ViroMapCameraState>) => void;
};
/** Camera position for a target/distance/yaw/pitch, and the Euler rotation that looks back at it. */
export declare function viroMapCameraTransform(s: Pick<ViroMapCameraState, "target" | "distance" | "yaw" | "pitch">): {
    position: Vec3;
    rotation: Vec3;
};
export declare function useViroMapCamera(options?: ViroMapCameraOptions): {
    /** Attach to the ViroNode that wraps the ViroCamera. */
    nodeRef: React.RefObject<any>;
    /** Spread onto that ViroNode. */
    nodeProps: {
        position: Vec3;
        rotation: Vec3;
    };
    /** Spread onto the ViroCamera. */
    cameraProps: {
        active: boolean;
        fieldOfView: number;
        projection: "orthographic" | "perspective";
        orthographicScale: number;
    };
    /** Spread onto the overlay View, together with onLayout. */
    panHandlers: import("react-native").GestureResponderHandlers;
    onLayout: (e: LayoutChangeEvent) => void;
    controls: {
        /** Drag the map by a screen delta in pixels. */
        panByPixels(dx: number, dy: number): void;
        /** factor > 1 zooms out, < 1 zooms in. */
        zoomBy(factor: number): void;
        orbitBy(deltaYaw: number, deltaPitch: number): void;
        /** Jump straight to a state, cancelling any flight in progress. */
        setState(next: Partial<ViroMapCameraState>): void;
        /** Ease to a state over `duration` ms. Resolves when it arrives. */
        flyTo(next: Partial<ViroMapCameraState>, duration?: number): Promise<void>;
        get(): Readonly<ViroMapCameraState>;
    };
};
export {};
