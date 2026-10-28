import type { StudioSceneResponse } from "../types";

export type StudioVpsState =
  | "idle"
  | "searching"
  | "mapLoaded"
  | "tracking"
  | "lost"
  | "error"
  | "unsupported";

export interface StudioVpsStateEvent {
  sceneId: string;
  locationId: string;
  state: StudioVpsState;
  /**
   * With `error` and `unsupported`. `code` is the server's own, or one that
   * `<ViroVPS>` sets on the device (`ViroVPSErrorDetail`).
   */
  error?: { code: string; status: number | null; message: string };
}

type StudioVpsError = NonNullable<StudioVpsStateEvent["error"]>;

/** Where a bound scene localises: `<ViroVPS localization>`. */
export type StudioVpsLocalization = "device" | "server";

export const STUDIO_VPS_UNSUPPORTED: StudioVpsError = {
  code: "UNSUPPORTED",
  status: null,
  message: "VPS needs an ARKit or ARCore session.",
};

// Leading zeros are refused because some resolvers read them as octal.
const IPV4 =
  /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/;

function isLocalNetworkHost(host: string): boolean {
  if (host === "localhost" || host === "[::1]") return true;
  if (/^\[f[cd][0-9a-f]{2}:/.test(host)) return true;
  const ip = IPV4.exec(host);
  if (!ip) return false;
  const [a, b, c, d] = ip.slice(1).map(Number);
  if (a > 255 || b > 255 || c > 255 || d > 255) return false;
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/**
 * Whether the session token or API key may be sent to `endpoint`: https, or
 * plain http to localhost or a private IP literal. Parsed by hand because
 * React Native's URL reads hosts with a regex of its own.
 */
export function studioVpsEndpointAllowed(endpoint: string): boolean {
  const match =
    /^([a-z][a-z\d+.-]*):\/\/(?:[^@/?#\\]*@)?(\[[^\]/?#\\]*\]|[^:/?#\\]*)/i.exec(
      endpoint
    );
  if (!match) return false;
  const scheme = match[1].toLowerCase();
  const host = match[2].toLowerCase();
  if (!host) return false;
  if (scheme === "https") return true;
  return scheme === "http" && isLocalNetworkHost(host);
}

export type StudioVpsBinding = {
  sceneId: string;
  locationId: string;
  /**
   * The VPS server the scene came with, for server mode. Null without one,
   * or for one no credential may be sent to; `<ViroVPS>` then asks Studio.
   */
  serverEndpoint: string | null;
};

export function studioVpsBinding(
  sceneData: StudioSceneResponse
): StudioVpsBinding | null {
  const { scene } = sceneData;
  if (!scene.vps_location_id) return null;
  const endpoint = sceneData.vps?.endpoint || null;
  return {
    sceneId: scene.id,
    locationId: scene.vps_location_id,
    serverEndpoint: endpoint && studioVpsEndpointAllowed(endpoint) ? endpoint : null,
  };
}

const RETRY_CODES = new Set([
  "NETWORK_ERROR",
  "CREDENTIALS_UNAVAILABLE",
  "MAP_LOAD_FAILED",
]);
const FINAL_CODES = new Set(["NO_ASSET", "PAID_PLAN_REQUIRED", "UNSUPPORTED"]);

/**
 * Whether a failed `startTracking()` may succeed if repeated: no answer, a
 * map load that failed, or the server's own trouble. Not a poll-time error
 * such as `LOCALIZATION_UNAVAILABLE`, which `<ViroVPS>` recovers from itself.
 */
export function studioVpsErrorIsTransient(error: StudioVpsError): boolean {
  if (FINAL_CODES.has(error.code)) return false;
  if (error.status === 401 || error.status === 403) return false;
  if (RETRY_CODES.has(error.code)) return true;
  return error.status !== null && (error.status >= 500 || error.status === 429);
}

/**
 * Automatic restarts after the map itself failed: it did not load, or went
 * away (an `idle`). Each one downloads the whole map again, so past these the
 * host's Retry is left to start again. A failure on the way to the map
 * (network, the server's own trouble) is retried for as long as the scene is
 * on screen.
 */
export const STUDIO_VPS_MAP_RETRIES = 4;

export function studioVpsMapFailed(
  state: StudioVpsState,
  error?: StudioVpsError
): boolean {
  return state === "idle" || error?.code === "MAP_LOAD_FAILED";
}

const RETRY_FIRST_MS = 2000;
const RETRY_MAX_MS = 60000;

/** 2 s, doubling to at most a minute. */
export function studioVpsRetryDelayMs(attempt: number): number {
  return Math.min(RETRY_FIRST_MS * 2 ** attempt, RETRY_MAX_MS);
}

export type StudioVpsHandle = {
  /** Ignored unless the scene is on screen and bound. */
  report: (state: StudioVpsState, error?: StudioVpsError) => void;
  release: () => void;
};

type Claim = {
  binding: StudioVpsBinding | null;
  setActive: (active: boolean) => void;
  retry: () => boolean;
  state: StudioVpsState;
  errorKey: string;
};

/**
 * One per navigator, which holds one VPS map. Pushed scenes stay mounted, so
 * of the scenes that claimed it, only the last one is active and tracks.
 */
export class StudioVpsCoordinator {
  onStateChange: ((event: StudioVpsStateEvent) => void) | null = null;
  private claims: Claim[] = [];
  private listeners = new Set<() => void>();

  constructor(public localization: StudioVpsLocalization = "device") {}

  /** The scene tracking now starts again in the new mode. */
  setLocalization(localization: StudioVpsLocalization) {
    if (localization === this.localization) return;
    this.localization = localization;
    for (const listener of this.listeners) listener();
  }

  /** For `useSyncExternalStore` over `localization`. */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * A scene mounting. The scene it covers is told first, so its map unloads
   * first. `retry` restarts its tracking, or answers false when it has none
   * to restart.
   */
  claim(
    binding: StudioVpsBinding | null,
    setActive: (active: boolean) => void,
    retry: () => boolean = () => false
  ): StudioVpsHandle {
    const claim: Claim = {
      binding,
      setActive,
      retry,
      state: "idle",
      errorKey: "",
    };
    const covered = this.top();
    this.claims.push(claim);
    if (covered) {
      covered.setActive(false);
      this.emit(covered, "idle");
    }
    setActive(true);
    return {
      report: (state, error) => {
        if (this.top() === claim) this.emit(claim, state, error);
      },
      release: () => this.release(claim),
    };
  }

  retry(): boolean {
    return this.top()?.retry() ?? false;
  }

  private release(claim: Claim) {
    const index = this.claims.indexOf(claim);
    if (index < 0) return;
    const wasTop = index === this.claims.length - 1;
    this.claims.splice(index, 1);
    this.emit(claim, "idle");
    if (wasTop) this.top()?.setActive(true);
  }

  private top(): Claim | undefined {
    return this.claims[this.claims.length - 1];
  }

  private emit(claim: Claim, state: StudioVpsState, error?: StudioVpsError) {
    const { binding } = claim;
    if (!binding) return;
    const errorKey = error
      ? `${error.code}|${error.status}|${error.message}`
      : "";
    if (claim.state === state && claim.errorKey === errorKey) return;
    claim.state = state;
    claim.errorKey = errorKey;
    this.onStateChange?.({
      sceneId: binding.sceneId,
      locationId: binding.locationId,
      state,
      ...(error ? { error } : {}),
    });
  }
}
