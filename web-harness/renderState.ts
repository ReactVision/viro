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
  /** Models mounted with a real file that have not finished loading. */
  loading: string[];
}

export const renderState: RenderState = { ready: false, error: null, warnings: [], loading: [] };

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

let mapStack: ((stack: string) => string) | null = null;

/** Set by the code that runs a scene, to name the scene's own files and lines in an error. */
export function setStackMapper(map: ((stack: string) => string) | null): void {
  mapStack = map;
}

export function markError(err: unknown): void {
  const text = err instanceof Error ? err.stack ?? err.message : String(err);
  renderState.error = renderState.error ?? (mapStack ? mapStack(text) : text);
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
