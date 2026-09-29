export type StudioColocationOptions = {
    mode: "host";
    /** Read when the room is created; a later change renames nothing. */
    name?: string;
    /** Co-location relay base URL. Defaults to production. */
    relayUrl?: string;
} | {
    mode: "join";
    /** The six-character join code, spaces and case ignored. */
    code: string;
    relayUrl?: string;
};
export type StudioColocationErrorCode = "PAID_PLAN_REQUIRED" | "ROOM_NOT_FOUND" | "ROOM_FULL" | "RELAY_AT_CAPACITY" | "FRAME_KIND_UNSUPPORTED" | "RESOLVE_NO_MATCH" | "HOST_FAILED" | "NOT_AUTHORIZED" | "SCENE_TOO_LARGE" | "UNAVAILABLE" | "UNKNOWN";
export type StudioColocationFrameKind = "cloud_anchor" | "meta_group" | "visionos_space";
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
export type StudioColocationState = {
    status: "idle";
} | {
    status: "scanning";
    canFinish: boolean;
} | {
    status: "hosting";
} | {
    status: "creating_room";
} | {
    status: "looking_up";
} | {
    status: "resolving";
    attempt: number;
    /** Once native has matched the space: matches so far, of the `needed` it takes. */
    seen?: {
        matches: number;
        needed: number;
    };
} | {
    status: "live";
    room: StudioColocationRoom;
    peers: number;
} | {
    status: "reconnecting";
    room: StudioColocationRoom;
} | {
    status: "failed";
    code: StudioColocationErrorCode;
    message: string;
};
