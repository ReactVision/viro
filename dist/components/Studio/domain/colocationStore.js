"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studioColocationStore = void 0;
const utils_1 = require("./utils");
const IDLE = { status: "idle" };
/**
 * The native pose channel is process-wide, so a device is in one shared session
 * at a time and this module singleton mirrors it. The navigator writes the
 * state; the indicator and useStudioColocation() read it wherever the host
 * renders them. The indicator's Done button reaches the running session
 * through the handler the navigator registers here.
 */
class StudioColocationStore {
    state = IDLE;
    originPrompt = null;
    finishScanHandler = null;
    builtInIndicator = true;
    listeners = new utils_1.GlobalListeners();
    getState() {
        return this.state;
    }
    subscribe(listener) {
        return this.listeners.subscribe(listener);
    }
    set(state) {
        if (this.state === state)
            return;
        this.state = state;
        this.listeners.notify();
    }
    getOriginPrompt() {
        return this.originPrompt;
    }
    setOriginPrompt(prompt) {
        if (this.originPrompt === prompt)
            return;
        this.originPrompt = prompt;
        this.listeners.notify();
    }
    /** The navigator's `colocationIndicator`, which the Quest HUD honours too. */
    isBuiltInIndicatorShown() {
        return this.builtInIndicator;
    }
    setBuiltInIndicatorShown(shown) {
        if (this.builtInIndicator === shown)
            return;
        this.builtInIndicator = shown;
        this.listeners.notify();
    }
    setFinishScanHandler(handler) {
        this.finishScanHandler = handler;
    }
    finishScan() {
        this.finishScanHandler?.();
    }
    /** Force idle so a torn-down session cannot leave the indicator showing. */
    reset() {
        this.finishScanHandler = null;
        if (this.state.status === "idle" && !this.originPrompt)
            return;
        this.state = IDLE;
        this.originPrompt = null;
        this.listeners.notify();
    }
}
exports.studioColocationStore = new StudioColocationStore();
