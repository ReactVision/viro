/**
 * VRQuestNavigatorBridge
 *
 * Carries VR "intents" and navigator operations from panel-Activity component
 * trees to VRActivity. Both activities run in the same process and share the
 * same Hermes JS engine, so a module-level store is sufficient — no native
 * round-trip needed.
 *
 * Flow:
 *   Panel (MainActivity)
 *     ViroXRSceneNavigator mounts
 *       → setIntent(scene, config)  — stores intent, notifies ViroQuestEntryPoint
 *       → launchVRScene()           — OS switches to VRActivity
 *       → ref.push(StudioScene)     — dispatchOp() queues the op
 *
 *   VRActivity mounts VRQuestScene → ViroQuestEntryPoint
 *       → onIntent cb fires      — reads intentKey + initialScene + rendererConfig
 *       → renders ViroVRSceneNavigator key={intentKey}  (fresh mount per intent)
 *       → ViroQuestEntryPoint captures viewTag → setViewTag()
 *       → subscribeOps() drains queued ops  — push(StudioScene) arrives
 *
 * Each call to setIntent() generates a new intentKey.  ViroQuestEntryPoint
 * uses key={intentKey} on ViroVRSceneNavigator, guaranteeing a clean navigator
 * stack whenever a different panel screen activates VR.
 */
export type VRNavigatorOp = {
    type: "push";
    scene: any;
} | {
    type: "pop";
} | {
    type: "popN";
    n: number;
} | {
    type: "replace";
    scene: any;
} | {
    type: "jump";
    scene: any;
};
/** Renderer flags forwarded from ViroXRSceneNavigator to ViroVRSceneNavigator. */
export type VRQuestRendererConfig = {
    hdrEnabled?: boolean;
    pbrEnabled?: boolean;
    bloomEnabled?: boolean;
    shadowsEnabled?: boolean;
    multisamplingEnabled?: boolean;
    vrModeEnabled?: boolean;
    passthroughEnabled?: boolean;
    handTrackingEnabled?: boolean;
    debug?: boolean;
    onExitViro?: () => void;
};
export type VRQuestIntent = {
    intentKey: string;
    initialScene: any;
    rendererConfig?: VRQuestRendererConfig;
};
export declare const VRQuestNavigatorBridge: {
    /**
     * Record the scene and renderer config that VRActivity should use, and
     * return a unique intent key. Call launchVRScene() after this.
     */
    setIntent(initialScene: any, rendererConfig?: VRQuestRendererConfig): string;
    /** Current intent (may be null if VR has never been launched). */
    getIntent(): VRQuestIntent | null;
    /**
     * Subscribe to intent changes. Fires immediately with the current intent if
     * one exists so that ViroQuestEntryPoint can render even if it mounts after
     * setIntent() was called.
     */
    onIntent(cb: (intent: VRQuestIntent) => void): () => void;
    dispatchOp(op: VRNavigatorOp): void;
    subscribeOps(cb: (op: VRNavigatorOp) => void): () => void;
    setVRActive(active: boolean): void;
    isVRActive(): boolean;
    setViewTag(tag: number | null): void;
    getViewTag(): number | null;
    /**
     * Subscribe to viewTag changes. Fires immediately with the current value.
     * Use this inside VR scenes that need VRModuleOpenXR (recenterTracking,
     * setPassthroughEnabled) without a direct ref to ViroVRSceneNavigator.
     */
    onViewTag(cb: (tag: number | null) => void): () => void;
    /** Called by ViroQuestEntryPoint's error boundary when a Quest scene throws. */
    reportQuestError(error: Error): void;
    /** Called by StudioSceneNavigator (panel side) to relay into its onError prop. */
    onQuestError(cb: (error: Error) => void): () => void;
};
