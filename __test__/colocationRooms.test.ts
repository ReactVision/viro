import {
  createColocationRoom,
  formatJoinCode,
  lookupColocationRoom,
  normaliseJoinCode,
} from "../components/AR/ViroColocationRooms";

const CONFIG = {
  apiKey: "rv_live_" + "a".repeat(64),
  projectId: "5eed0000-0000-4000-8000-000000000013",
  endpoint: "http://127.0.0.1:54321",
};

const ROOM_ROW = {
  id: "3f2b9c10-0000-4000-8000-abcdefabcdef",
  room_id: "3f2b9c10-0000-4000-8000-abcdefabcdef",
  join_code: "K7M2QX",
  frame_kind: "cloud_anchor",
  cloud_anchor_id: "aaaa0000-0000-4000-8000-aaaaaaaaaaaa",
  frame_ref: null,
  name: "Bay 3",
};

const ok = (body: unknown) =>
  jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  });

const failed = (status: number, code: string, message: string) =>
  jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error: { code, message } }),
  });

afterEach(() => {
  // @ts-expect-error the global is restored per test
  delete global.fetch;
});

describe("join codes", () => {
  it("takes what a person types and returns what the platform stores", () => {
    expect(normaliseJoinCode("k7m 2qx")).toBe("K7M2QX");
    expect(normaliseJoinCode(" K7M-2QX ")).toBe("K7M2QX");
  });

  it("refuses a code holding a character the alphabet does not have", () => {
    // O, 0, I, 1, L and U are absent so a code is unambiguous on screen; typing
    // one is a typo to report rather than a character to guess at.
    expect(normaliseJoinCode("K7M2Q0")).toBeNull();
    expect(normaliseJoinCode("K7MIQX")).toBeNull();
    expect(normaliseJoinCode("K7M2Q")).toBeNull();
  });

  it("groups a code the way it is read out", () => {
    expect(formatJoinCode("K7M2QX")).toBe("K7M 2QX");
  });
});

describe("createColocationRoom", () => {
  it("sends the frame and the device's own credentials", async () => {
    const fetchMock = ok({ room: ROOM_ROW });
    // @ts-expect-error installing the stub
    global.fetch = fetchMock;

    const result = await createColocationRoom(CONFIG, {
      frameKind: "cloud_anchor",
      cloudAnchorId: ROOM_ROW.cloud_anchor_id,
      name: "Bay 3",
    });

    expect(result.success).toBe(true);
    expect(result.success && result.room.joinCode).toBe("K7M2QX");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:54321/functions/v1/colocation/rooms");
    expect(init.headers["x-api-key"]).toBe(CONFIG.apiKey);
    expect(init.headers["x-project-id"]).toBe(CONFIG.projectId);
    expect(JSON.parse(init.body)).toMatchObject({
      frame_kind: "cloud_anchor",
      cloud_anchor_id: ROOM_ROW.cloud_anchor_id,
    });
  });

  it("sends frame_ref for a Meta group and no anchor", async () => {
    const fetchMock = ok({ room: { ...ROOM_ROW, frame_kind: "meta_group" } });
    // @ts-expect-error installing the stub
    global.fetch = fetchMock;

    await createColocationRoom(CONFIG, {
      frameKind: "meta_group",
      frameRef: "bbbb0000-0000-4000-8000-bbbbbbbbbbbb",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.frame_ref).toBe("bbbb0000-0000-4000-8000-bbbbbbbbbbbb");
    expect(body.cloud_anchor_id).toBeUndefined();
  });

  it("reports the platform's own refusal rather than a status code", async () => {
    // @ts-expect-error installing the stub
    global.fetch = failed(
      403,
      "PAID_PLAN_REQUIRED",
      "Co-location requires a paid plan."
    );

    const result = await createColocationRoom(CONFIG, {
      frameKind: "visionos_space",
    });

    expect(result.success).toBe(false);
    expect(!result.success && result.code).toBe("PAID_PLAN_REQUIRED");
    expect(!result.success && result.error).toBe(
      "Co-location requires a paid plan."
    );
  });

  it("does not throw when the network does", async () => {
    // @ts-expect-error installing the stub
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("Network request failed"));

    const result = await createColocationRoom(CONFIG, {
      frameKind: "visionos_space",
    });
    expect(result.success).toBe(false);
    expect(!result.success && result.error).toBe("Network request failed");
  });
});

describe("lookupColocationRoom", () => {
  it("normalises before asking, so a typed code with a space still works", async () => {
    const fetchMock = ok({ room: ROOM_ROW });
    // @ts-expect-error installing the stub
    global.fetch = fetchMock;

    const result = await lookupColocationRoom(CONFIG, "k7m 2qx");

    expect(result.success).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://127.0.0.1:54321/functions/v1/colocation/rooms/K7M2QX"
    );
  });

  it("refuses a code that could never exist without spending a request", async () => {
    const fetchMock = ok({ room: ROOM_ROW });
    // @ts-expect-error installing the stub
    global.fetch = fetchMock;

    const result = await lookupColocationRoom(CONFIG, "nope");

    expect(result.success).toBe(false);
    expect(!result.success && result.code).toBe("INVALID_JOIN_CODE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes an unknown code back as the 404 it is", async () => {
    // @ts-expect-error installing the stub
    global.fetch = failed(404, "ROOM_NOT_FOUND", "Room not found");

    const result = await lookupColocationRoom(CONFIG, "K7M2QZ");
    expect(result.success).toBe(false);
    expect(!result.success && result.code).toBe("ROOM_NOT_FOUND");
  });
});
