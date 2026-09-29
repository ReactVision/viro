"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studioColocationStore = void 0;
const utils_1 = require("./utils");
const IDLE = { status: "idle" };
/** Calls that pass no owner, as a single writer would. */
const UNOWNED = {};
/**
 * The native pose channel is process-wide, so a device is in one shared session
 * at a time and this module singleton mirrors it. The navigator writes the
 * state; the indicator and useStudioColocation() read it wherever the host
 * renders them. The indicator's Done button reaches the running session
 * through the handler the navigator registers here.
 *
 * More than one navigator can be mounted (a screen pushed over another), so
 * each writes with its own owner token. The first to report a session owns the
 * store until it reports idle again or unmounts; meanwhile the others' writes
 * and resets are ignored, so unmounting one navigator never clears another's
 * live session.
 */
class StudioColocationStore {
    state = IDLE;
    originPrompt = null;
    owner = null;
    finishScanHandlers = new Map();
    builtInIndicator = new Map();
    listeners = new utils_1.GlobalListeners();
    getState() {
        return this.state;
    }
    subscribe(listener) {
        return this.listeners.subscribe(listener);
    }
    /** Ignored while another owner's session is reported. */
    set(state, owner = UNOWNED) {
        if (!this.writable(owner))
            return;
        this.owner = state.status === "idle" ? null : owner;
        if (this.state === state)
            return;
        this.state = state;
        this.listeners.notify();
    }
    getOriginPrompt() {
        return this.originPrompt;
    }
    setOriginPrompt(prompt, owner = UNOWNED) {
        if (!this.writable(owner) || this.originPrompt === prompt)
            return;
        this.originPrompt = prompt;
        this.listeners.notify();
    }
    /** The owning navigator's `colocationIndicator`, which the Quest HUD honours too. */
    isBuiltInIndicatorShown() {
        return this.builtInIndicator.get(this.owner ?? UNOWNED) ?? true;
    }
    setBuiltInIndicatorShown(shown, owner = UNOWNED) {
        const before = this.isBuiltInIndicatorShown();
        this.builtInIndicator.set(owner, shown);
        if (this.isBuiltInIndicatorShown() !== before)
            this.listeners.notify();
    }
    setFinishScanHandler(handler, owner = UNOWNED) {
        if (handler)
            this.finishScanHandlers.set(owner, handler);
        else
            this.finishScanHandlers.delete(owner);
    }
    /** The owning session's scan. False when none is scanning or it cannot finish yet. */
    finishScan() {
        return this.finishScanHandlers.get(this.owner ?? UNOWNED)?.() ?? false;
    }
    /**
     * A navigator unmounting: forgets its handler and indicator setting, and
     * forces idle when it owns the store (or nothing does), so a torn-down
     * session cannot leave the indicator showing. With no owner, resets all.
     */
    reset(owner) {
        if (owner === undefined) {
            this.finishScanHandlers.clear();
            this.builtInIndicator.clear();
        }
        else {
            this.finishScanHandlers.delete(owner);
            this.builtInIndicator.delete(owner);
            if (!this.writable(owner))
                return;
        }
        this.owner = null;
        if (this.state.status === "idle" && !this.originPrompt)
            return;
        this.state = IDLE;
        this.originPrompt = null;
        this.listeners.notify();
    }
    writable(owner) {
        return this.owner === null || this.owner === owner;
    }
}
exports.studioColocationStore = new StudioColocationStore();
