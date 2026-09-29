import {
  estimateSharedEntities,
  STUDIO_COLOCATION_ENTITY_LIMIT,
} from "../components/Studio/colocation/budget";
import {
  originRejectFailure,
  relayErrorCode,
  resolveErrorCode,
  roomErrorCode,
} from "../components/Studio/colocation/errors";
import { studioColocationIndicatorContent } from "../components/Studio/colocation/indicatorContent";
import { probeRelayRoom } from "../components/Studio/colocation/relayProbe";
import { studioColocationStore } from "../components/Studio/domain/colocationStore";
import type { StudioSceneResponse } from "../components/Studio/types";

describe("roomErrorCode", () => {
  it.each([
    [403, "PAID_PLAN_REQUIRED", "PAID_PLAN_REQUIRED"],
    [404, "ROOM_NOT_FOUND", "ROOM_NOT_FOUND"],
    [undefined, "INVALID_JOIN_CODE", "ROOM_NOT_FOUND"],
    [undefined, "MISSING_API_KEY", "NOT_AUTHORIZED"],
    [401, "INVALID_SESSION", "NOT_AUTHORIZED"],
    [403, "PROJECT_ACCESS_DENIED", "NOT_AUTHORIZED"],
    [403, undefined, "NOT_AUTHORIZED"],
    [503, "SESSION_LOOKUP_FAILED", "UNAVAILABLE"],
    [500, undefined, "UNAVAILABLE"],
    [429, undefined, "UNAVAILABLE"],
    [undefined, undefined, "UNAVAILABLE"],
    [undefined, "MISSING_PROJECT_ID", "UNKNOWN"],
    [400, "INVALID_SCENE_ID", "UNKNOWN"],
    [409, "TOO_MANY_ROOMS", "UNKNOWN"],
  ])("maps %s %s to %s", (status, code, expected) => {
    expect(roomErrorCode(status, code)).toBe(expected);
  });
});

describe("relayErrorCode", () => {
  it.each([
    [503, "ROOM_FULL", "ROOM_FULL"],
    [503, "RELAY_AT_CAPACITY", "RELAY_AT_CAPACITY"],
    [403, "PAID_PLAN_REQUIRED", "PAID_PLAN_REQUIRED"],
    [401, "INVALID_SESSION_FORMAT", "NOT_AUTHORIZED"],
    [403, "PROJECT_ACCESS_DENIED", "NOT_AUTHORIZED"],
    [429, "TOO_MANY_CONNECTIONS", "UNAVAILABLE"],
    [503, "RELAY_DRAINING", "UNAVAILABLE"],
    [503, "AUTH_UNAVAILABLE", "UNAVAILABLE"],
    [404, "NOT_FOUND", "UNAVAILABLE"],
    [undefined, undefined, "UNAVAILABLE"],
    [400, "INVALID_ROOM_ID", "UNKNOWN"],
  ])("maps %s %s to %s", (status, code, expected) => {
    expect(relayErrorCode(status, code)).toBe(expected);
  });
});

describe("resolveErrorCode", () => {
  it.each([
    ["ErrorResolvingLocalizationNoMatch", "RESOLVE_NO_MATCH"],
    ["ErrorCloudIdNotFound", "RESOLVE_NO_MATCH"],
    ["ErrorAnchorExpired", "RESOLVE_NO_MATCH"],
    [undefined, "RESOLVE_NO_MATCH"],
    ["ErrorNotAuthorized", "NOT_AUTHORIZED"],
    ["ErrorAuthenticationFailed", "NOT_AUTHORIZED"],
    ["ErrorResourceExhausted", "UNAVAILABLE"],
    ["ErrorNetworkFailure", "UNAVAILABLE"],
    ["ErrorNotSupported", "FRAME_KIND_UNSUPPORTED"],
  ] as const)("maps %s to %s", (state, expected) => {
    expect(resolveErrorCode(state)).toBe(expected);
  });
});

describe("estimateSharedEntities", () => {
  const asset = (over: Record<string, unknown> = {}) => ({
    id: "a",
    is_draggable: false,
    tap_to_place: false,
    trigger_image_url: null,
    ...over,
  });

  it("counts a row per variable, asset, placement and drag, plus the fixed ones", () => {
    const sceneData = {
      assets: [
        asset(),
        asset({ is_draggable: true }),
        asset({ tap_to_place: true }),
        // Image triggering wins over tap-to-place, so this one never places.
        asset({ tap_to_place: true, trigger_image_url: "https://x/img.png" }),
      ],
      variables: [{}, {}, {}],
    } as unknown as StudioSceneResponse;
    // 2 + 3 variables + 4 assets + 1 placement + 1 drag + 16 event slots
    expect(estimateSharedEntities(sceneData)).toBe(27);
  });

  it("stays under the relay's room cap", () => {
    expect(STUDIO_COLOCATION_ENTITY_LIMIT).toBeLessThan(512);
  });
});

describe("probeRelayRoom", () => {
  afterEach(() => {
    delete (global as any).fetch;
  });

  it("describes the channel room with the handshake headers", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ endpoint: "colocation", roomId: "r 1", peers: 3 }),
    });
    (global as any).fetch = fetchMock;
    const result = await probeRelayRoom("https://relay.example/", "r 1", {
      Authorization: "Bearer t",
      "x-project-id": "p",
    });
    expect(result).toEqual({ ok: true, peers: 3 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://relay.example/functions/v1/colocation/r%201",
      {
        method: "GET",
        headers: { Authorization: "Bearer t", "x-project-id": "p" },
      }
    );
  });

  it("passes a refusal's status and code through", async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: { code: "ROOM_FULL", message: "This room is full" },
      }),
    });
    expect(await probeRelayRoom("https://relay.example", "r", {})).toEqual({
      ok: false,
      status: 503,
      code: "ROOM_FULL",
      message: "This room is full",
    });
  });

  it("reports a request that never reached the relay", async () => {
    (global as any).fetch = jest
      .fn()
      .mockRejectedValue(new Error("Network request failed"));
    expect(await probeRelayRoom("https://relay.example", "r", {})).toEqual({
      ok: false,
      message: "Network request failed",
    });
  });
});

describe("originRejectFailure", () => {
  it("reads a full room as a scene too large and a team ceiling as unavailable", () => {
    expect(originRejectFailure("too-many-entities").code).toBe(
      "SCENE_TOO_LARGE"
    );
    expect(originRejectFailure("room-too-large").code).toBe("SCENE_TOO_LARGE");
    expect(originRejectFailure("org-too-large")).toEqual({
      code: "UNAVAILABLE",
      message: "The relay refused the shared scene origin (org-too-large).",
    });
    expect(originRejectFailure("not-owner").code).toBe("UNKNOWN");
  });
});

describe("studioColocationStore", () => {
  afterEach(() => studioColocationStore.reset());

  it("notifies on change and resets to idle", () => {
    const listener = jest.fn();
    const unsubscribe = studioColocationStore.subscribe(listener);
    const scanning = { status: "scanning" as const, canFinish: false };
    studioColocationStore.set(scanning);
    studioColocationStore.set(scanning);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(studioColocationStore.getState()).toBe(scanning);
    studioColocationStore.reset();
    expect(studioColocationStore.getState()).toEqual({ status: "idle" });
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("routes Done to the running session until reset", () => {
    const finish = jest.fn();
    studioColocationStore.setFinishScanHandler(finish);
    studioColocationStore.finishScan();
    studioColocationStore.reset();
    studioColocationStore.finishScan();
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it("clears the origin prompt on reset", () => {
    const listener = jest.fn();
    const unsubscribe = studioColocationStore.subscribe(listener);
    const prompt = { joinCode: "K7M2QX", tap: true };
    studioColocationStore.setOriginPrompt(prompt);
    expect(studioColocationStore.getOriginPrompt()).toBe(prompt);
    studioColocationStore.reset();
    expect(studioColocationStore.getOriginPrompt()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});

describe("studioColocationIndicatorContent", () => {
  const room = {
    id: "row",
    roomId: "room",
    joinCode: "K7M2QX",
    joinUrl: "https://studio.reactvision.xyz/j/K7M2QX",
    projectId: "p",
    sceneId: "s",
    frameKind: "cloud_anchor" as const,
    isHost: true,
  };

  it("shows nothing while idle", () => {
    expect(studioColocationIndicatorContent({ status: "idle" })).toBeNull();
  });

  it("offers Done once the scan covers enough", () => {
    expect(
      studioColocationIndicatorContent({ status: "scanning", canFinish: false })
        ?.done
    ).toEqual({ enabled: false });
    expect(
      studioColocationIndicatorContent({ status: "scanning", canFinish: true })
        ?.done
    ).toEqual({ enabled: true });
  });

  it("tells a joiner how many times the space has matched", () => {
    expect(
      studioColocationIndicatorContent({
        status: "resolving",
        attempt: 1,
        seen: { matches: 2, needed: 3 },
      })?.detail
    ).toBe("Matched the area 2 of 3 times. Keep moving your device slowly.");
    expect(
      studioColocationIndicatorContent({ status: "resolving", attempt: 2 })
        ?.detail
    ).toBe("Still looking. Move slowly around the area the host scanned.");
  });

  it("shows the host the code and the peer count", () => {
    const content = studioColocationIndicatorContent({
      status: "live",
      room,
      peers: 2,
    });
    expect(content?.code).toBe("K7M 2QX");
    expect(content?.detail).toBe("2 other devices");
    expect(
      studioColocationIndicatorContent({
        status: "live",
        room: { ...room, isHost: false },
        peers: 1,
      })
    ).toMatchObject({ code: null, detail: "1 other device" });
  });

  it("tells the host to place the scene once the room has a code", () => {
    expect(
      studioColocationIndicatorContent({ status: "creating_room" })
    ).toMatchObject({ title: "Creating the room", code: null });
    expect(
      studioColocationIndicatorContent(
        { status: "creating_room" },
        { joinCode: "K7M2QX", tap: true }
      )
    ).toMatchObject({
      code: "K7M 2QX",
      detail: "Tap a surface to place the scene.",
    });
    expect(
      studioColocationIndicatorContent(
        { status: "creating_room" },
        { joinCode: "K7M2QX", tap: false }
      )?.detail
    ).toBe("Point your device at a surface to place the scene.");
    expect(
      studioColocationIndicatorContent(
        { status: "live", room, peers: 0 },
        { joinCode: "K7M2QX", tap: true }
      )?.title
    ).toBe("Sharing this room");
  });

  it("shows why a session failed", () => {
    expect(
      studioColocationIndicatorContent({
        status: "failed",
        code: "ROOM_FULL",
        message: "This room is full.",
      })
    ).toMatchObject({ tone: "error", detail: "This room is full." });
  });
});
