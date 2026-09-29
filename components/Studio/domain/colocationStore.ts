import type { StudioColocationOriginPrompt } from "../colocation/indicatorContent";
import type { StudioColocationState } from "../colocation/types";
import { GlobalListeners } from "./utils";

const IDLE: StudioColocationState = { status: "idle" };

/**
 * The native pose channel is process-wide, so a device is in one shared session
 * at a time and this module singleton mirrors it. The navigator writes the
 * state; the indicator and useStudioColocation() read it wherever the host
 * renders them. The indicator's Done button reaches the running session
 * through the handler the navigator registers here.
 */
class StudioColocationStore {
  private state: StudioColocationState = IDLE;
  private originPrompt: StudioColocationOriginPrompt | null = null;
  private finishScanHandler: (() => boolean) | null = null;
  private builtInIndicator = true;
  private listeners = new GlobalListeners();

  getState(): StudioColocationState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    return this.listeners.subscribe(listener);
  }

  set(state: StudioColocationState): void {
    if (this.state === state) return;
    this.state = state;
    this.listeners.notify();
  }

  getOriginPrompt(): StudioColocationOriginPrompt | null {
    return this.originPrompt;
  }

  setOriginPrompt(prompt: StudioColocationOriginPrompt | null): void {
    if (this.originPrompt === prompt) return;
    this.originPrompt = prompt;
    this.listeners.notify();
  }

  /** The navigator's `colocationIndicator`, which the Quest HUD honours too. */
  isBuiltInIndicatorShown(): boolean {
    return this.builtInIndicator;
  }

  setBuiltInIndicatorShown(shown: boolean): void {
    if (this.builtInIndicator === shown) return;
    this.builtInIndicator = shown;
    this.listeners.notify();
  }

  setFinishScanHandler(handler: (() => boolean) | null): void {
    this.finishScanHandler = handler;
  }

  /** False when no session is scanning or the scan cannot finish yet. */
  finishScan(): boolean {
    return this.finishScanHandler?.() ?? false;
  }

  /** Force idle so a torn-down session cannot leave the indicator showing. */
  reset(): void {
    this.finishScanHandler = null;
    if (this.state.status === "idle" && !this.originPrompt) return;
    this.state = IDLE;
    this.originPrompt = null;
    this.listeners.notify();
  }
}

export const studioColocationStore = new StudioColocationStore();
