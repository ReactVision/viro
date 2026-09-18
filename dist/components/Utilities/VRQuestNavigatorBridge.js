"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VRQuestNavigatorBridge = void 0;
// ── Intent store ────────────────────────────────────────────────────────────
let _intent = null;
const _intentListeners = new Set();
// ── Op queue ─────────────────────────────────────────────────────────────────
const _opListeners = new Set();
const _opQueue = [];
let _opCounter = 0;
// ── VR active flag ────────────────────────────────────────────────────────────
// True while VRActivity is running. Set to true just before launchVRScene(),
// set to false by exitVRScene(). The AppState-based relaunch in
// ViroXRSceneNavigator checks this so it only fires for system-level
// backgrounding (Quest menu / home), not for explicit exits.
let _vrActive = false;
// ── ViewTag store ─────────────────────────────────────────────────────────────
// ViroQuestEntryPoint populates this after ViroVRSceneNavigator mounts.
// Panel-side code (e.g. VRModuleOpenXR.recenterTracking) reads it to target
// the live native view without needing a direct ref to ViroVRSceneNavigator.
let _viewTag = null;
const _viewTagListeners = new Set();
// ── Quest scene error relay ──────────────────────────────────────────────────
// VRActivity is a separate React root (see module doc above), so no panel-side
// error boundary can ever see a scene crash there. ViroQuestEntryPoint's own
// boundary catches it and reports here; StudioSceneNavigator subscribes and
// forwards into the same onError prop it already uses for phone-AR errors, so
// a host's existing Sentry wiring picks up Quest crashes with no changes on
// its end. Fire-and-forget (no replay-on-subscribe like onIntent/onViewTag) —
// a crash is an event, not state a late subscriber should see again.
const _questErrorListeners = new Set();
exports.VRQuestNavigatorBridge = {
    // ── Called by ViroXRSceneNavigator when mounting on Quest ──────────────────
    /**
     * Record the scene and renderer config that VRActivity should use, and
     * return a unique intent key. Call launchVRScene() after this.
     */
    setIntent(initialScene, rendererConfig) {
        const intentKey = `vr-${Date.now()}-${++_opCounter}`;
        _intent = { intentKey, initialScene, rendererConfig };
        // Clear any stale ops from the previous intent.
        _opQueue.length = 0;
        _intentListeners.forEach((l) => l(_intent));
        return intentKey;
    },
    /** Current intent (may be null if VR has never been launched). */
    getIntent() {
        return _intent;
    },
    /**
     * Subscribe to intent changes. Fires immediately with the current intent if
     * one exists so that ViroQuestEntryPoint can render even if it mounts after
     * setIntent() was called.
     */
    onIntent(cb) {
        _intentListeners.add(cb);
        if (_intent)
            cb(_intent);
        return () => {
            _intentListeners.delete(cb);
        };
    },
    // ── Called by ViroXRSceneNavigator ref (push / pop / etc.) ────────────────
    dispatchOp(op) {
        if (_opListeners.size > 0) {
            _opListeners.forEach((l) => l(op));
        }
        else {
            _opQueue.push(op);
        }
    },
    // ── Called by ViroQuestEntryPoint after ViroVRSceneNavigator mounts ────────
    subscribeOps(cb) {
        _opListeners.add(cb);
        const pending = _opQueue.splice(0);
        pending.forEach((op) => cb(op));
        return () => {
            _opListeners.delete(cb);
        };
    },
    // ── VR active flag ────────────────────────────────────────────────────────
    setVRActive(active) {
        _vrActive = active;
    },
    isVRActive() {
        return _vrActive;
    },
    // ── ViewTag — native node handle of the live ViroVRSceneNavigator ──────────
    setViewTag(tag) {
        _viewTag = tag;
        _viewTagListeners.forEach((l) => l(tag));
    },
    getViewTag() {
        return _viewTag;
    },
    /**
     * Subscribe to viewTag changes. Fires immediately with the current value.
     * Use this inside VR scenes that need VRModuleOpenXR (recenterTracking,
     * setPassthroughEnabled) without a direct ref to ViroVRSceneNavigator.
     */
    onViewTag(cb) {
        _viewTagListeners.add(cb);
        cb(_viewTag);
        return () => {
            _viewTagListeners.delete(cb);
        };
    },
    // ── Quest scene error relay ────────────────────────────────────────────────
    /** Called by ViroQuestEntryPoint's error boundary when a Quest scene throws. */
    reportQuestError(error) {
        _questErrorListeners.forEach((l) => l(error));
    },
    /** Called by StudioSceneNavigator (panel side) to relay into its onError prop. */
    onQuestError(cb) {
        _questErrorListeners.add(cb);
        return () => {
            _questErrorListeners.delete(cb);
        };
    },
};
