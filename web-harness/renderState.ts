/**
 * Shared readiness/error/warning channel between render.tsx (and the modules
 * it drives, e.g. viroWebComponents.ts's unsupported-component stubs) and the
 * Playwright driver in reactviro-mcp-server (src/render/runScene.ts), which
 * polls `window.__renderState.ready` and reads the rest off the same object.
 */
export interface RenderState {
  ready: boolean;
  error: string | null;
  warnings: string[];
}

export const renderState: RenderState = { ready: false, error: null, warnings: [] };

export function pushWarning(message: string): void {
  // Re-renders (e.g. a stub component mounted more than once) would
  // otherwise repeat the identical warning; the caller cares that it
  // happened, not how many times.
  if (!renderState.warnings.includes(message)) {
    renderState.warnings.push(message);
  }
}

export function markReady(): void {
  renderState.ready = true;
}

export function markError(err: unknown): void {
  renderState.error =
    renderState.error ?? (err instanceof Error ? err.stack ?? err.message : String(err));
  // An error is terminal for this render — flip ready too so the driver's
  // waitForFunction resolves immediately instead of waiting out the timeout.
  renderState.ready = true;
}

declare global {
  interface Window {
    __renderState: RenderState;
  }
}

window.__renderState = renderState;
window.addEventListener("error", (e) => markError(e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => markError((e as PromiseRejectionEvent).reason));
