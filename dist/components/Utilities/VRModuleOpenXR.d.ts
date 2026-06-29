/**
 * Finishes VRActivity and returns the user to the panel (MainActivity).
 * Safe to call on any platform — no-op when VRLauncher is unavailable.
 */
export declare function exitVRScene(): void;
export type VRModuleOpenXRType = {
    recenterTracking?: (viewTag: number) => void;
    setPassthroughEnabled?: (viewTag: number, enabled: boolean) => void;
    setPassthroughStyle?: (viewTag: number, opacity: number, edgeR: number, edgeG: number, edgeB: number, edgeA: number) => void;
};
/** Options for {@link setPassthroughStyle}. All channels are normalized [0,1]. */
export type ViroPassthroughStyle = {
    /** Texture opacity factor [0,1]. Default 1 (fully opaque passthrough). */
    opacity?: number;
    /** Edge-highlight colour [r,g,b,a]. Alpha 0 (default) disables the edge effect. */
    edgeColor?: [number, number, number, number];
};
/**
 * Style the Quest passthrough layer (XR_FB_passthrough). No-op off-Quest.
 *
 * ```tsx
 * const viewTag = useVRViewTag();
 * if (viewTag != null) {
 *   setPassthroughStyle(viewTag, { opacity: 0.8, edgeColor: [0, 1, 1, 1] });
 * }
 * ```
 */
export declare function setPassthroughStyle(viewTag: number, style: ViroPassthroughStyle): void;
/**
 * Typed reference to the VRModuleOpenXR native module.
 * undefined when not running on Meta Quest (no-op calls are safe via optional chaining).
 */
export declare const VRModuleOpenXR: VRModuleOpenXRType | undefined;
/**
 * Returns the live viewTag of the ViroVRSceneNavigator running in VRActivity,
 * kept in sync via VRQuestNavigatorBridge.  null until ViroQuestEntryPoint has
 * mounted and published the tag.
 *
 * Use this inside VR scenes when you need to call VRModuleOpenXR methods:
 *
 * ```tsx
 * function MyVRScene() {
 *   const viewTag = useVRViewTag();
 *   const recenter = () => {
 *     if (viewTag != null) VRModuleOpenXR?.recenterTracking?.(viewTag);
 *   };
 *   return <ViroScene>...</ViroScene>;
 * }
 * ```
 */
export declare function useVRViewTag(): number | null;
