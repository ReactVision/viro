import type { ViroVPSCredentialsSource } from "../../AR/ViroVPSClient";

type StudioColocationCommonOptions = {
  /** Co-location relay base URL. Defaults to production. */
  relayUrl?: string;
  /**
   * Credentials as `<ViroVPS credentials>` takes them, such as the function
   * createUserTokenCredentials() makes, sent in place of the native credential
   * (`rvApiKey`, or the host's Studio session) by the co-location calls: the
   * room's create or lookup, the relay's checks, the pose channel and the
   * shared state. They are sent for the scene's project in place of their own.
   * Scene loads, cloud anchors and VPS keep the native credential, so a phone
   * still needs it to host or resolve the room's anchor.
   *
   * A new value does not restart the session, and the next call or reconnect
   * uses it, with one exception: while a session runs, credentials that become
   * another createUserTokenCredentials() object, or stop or start being one,
   * and a clear() of the one in use, fail it with `NOT_AUTHORIZED`, so a
   * signed-out user's token does not stay in the room. `retryColocation()`
   * starts it again.
   */
  credentials?: ViroVPSCredentialsSource;
  /**
   * How long a device waits, once it has its frame, before it gives up on the
   * room: a host until the channel and the shared state are connected
   * (placing the scene's origin is not timed), a joiner until the session is
   * live. Fails with `CONNECT_TIMEOUT`, or `HOST_TIMEOUT` for a joiner that
   * connected but never received the host's scene origin. Default 60000;
   * 0 waits indefinitely. Read when the session starts.
   */
  connectTimeoutMs?: number;
};

export type StudioColocationOptions =
  | ({
      mode: "host";
      /** Read when the room is created; a later change renames nothing. */
      name?: string;
    } & StudioColocationCommonOptions)
  | ({
      mode: "join";
      /** The six-character join code, spaces and case ignored. */
      code: string;
    } & StudioColocationCommonOptions);

export type StudioColocationErrorCode =
  | "PAID_PLAN_REQUIRED"
  /** The team's monthly compute spend, which co-location is billed from, is at its limit. */
  | "COMPUTE_SPEND_LIMIT_REACHED"
  /** The team has no card for compute time, or a compute invoice is unpaid. */
  | "COMPUTE_BILLING_REFUSED"
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "RELAY_AT_CAPACITY"
  | "FRAME_KIND_UNSUPPORTED"
  | "RESOLVE_NO_MATCH"
  | "HOST_FAILED"
  | "NOT_AUTHORIZED"
  | "SCENE_TOO_LARGE"
  /** The scene is placed in an Advanced VPS map, which a co-location frame does not share. */
  | "SCENE_BOUND_TO_VPS"
  | "UNAVAILABLE"
  /** The channel or the shared state did not connect within `connectTimeoutMs`. */
  | "CONNECT_TIMEOUT"
  /** Joiner: connected, but the host's scene origin did not arrive within `connectTimeoutMs`. */
  | "HOST_TIMEOUT"
  | "UNKNOWN";

export type StudioColocationFrameKind =
  "cloud_anchor" | "meta_group" | "visionos_space";

export type StudioColocationRoom = {
  id: string;
  roomId: string;
  joinCode: string | null;
  /** `https://studio.reactvision.xyz/j/<code>`, null without a code. */
  joinUrl: string | null;
  projectId: string;
  sceneId: string | null;
  frameKind: StudioColocationFrameKind;
  isHost: boolean;
};

export type StudioColocationState =
  | { status: "idle" }
  | {
      status: "scanning";
      /** The scan covers enough to host: `finishColocationScan()` and Done work. */
      canFinish: boolean;
      /**
       * Points triangulated so far, of the `needed` hosting takes. Only from a
       * renderer that reports them.
       */
      points?: { count: number; needed: number };
    }
  | { status: "hosting" }
  | { status: "creating_room" }
  | { status: "looking_up" }
  | {
      status: "resolving";
      attempt: number;
      /** Once native has matched the space: matches so far, of the `needed` it takes. */
      seen?: { matches: number; needed: number };
    }
  /**
   * Joiner: aligned and connected, and the room has no scene origin yet, so
   * the host has not placed the scene (or has not finished connecting).
   */
  | { status: "waiting_for_host"; room: StudioColocationRoom }
  | { status: "live"; room: StudioColocationRoom; peers: number }
  | { status: "reconnecting"; room: StudioColocationRoom }
  | {
      status: "failed";
      code: StudioColocationErrorCode;
      message: string;
    };
