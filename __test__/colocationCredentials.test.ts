/**
 * Copyright © 2026 ReactVision
 *
 * Co-location given credentials, as <ViroVPS credentials> takes them: the
 * pose channel gets the user token for its join and a renewed one before it
 * expires, the room helpers and the replication socket send it in place of
 * the key and renew a refused one once, and without credentials every call
 * is what it was.
 */
jest.mock("react-native", () => ({
  NativeModules: {
    VRTColocationModule: {
      join: jest.fn(),
      leave: jest.fn(),
      setAccessToken: jest.fn(),
    },
  },
  Platform: { OS: "ios", constants: {} },
}));

import { joinColocation, leaveColocation } from "../components/AR/ViroColocation";
import { createColocationRoom, lookupColocationRoom } from "../components/AR/ViroColocationRooms";
import { ViroReplicationClient } from "../components/AR/ViroReplication";
import { createUserTokenCredentials } from "../components/AR/ViroUserTokenCredentials";

const native = jest.requireMock("react-native").NativeModules.VRTColocationModule;
const S = 1000;

/** fetchToken answering u1, u2, ... each `life` seconds long. */
function backend(life = 3600) {
  let n = 0;
  return jest.fn(async () => ({ token: `u${++n}`, expires_in: life }));
}

function tokenCredentials(fetchToken = backend()) {
  return createUserTokenCredentials({ projectId: "p", fetchToken });
}

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

function answer(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const fetchSpy = jest.fn();
const sentHeaders = (i: number) => fetchSpy.mock.calls[i][1].headers as Record<string, string>;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(1_000_000);
  native.join.mockReset().mockResolvedValue({ success: true });
  native.leave.mockReset().mockResolvedValue(true);
  native.setAccessToken.mockReset().mockResolvedValue(true);
  fetchSpy.mockReset();
  (globalThis as any).fetch = fetchSpy;
});

afterEach(async () => {
  await leaveColocation();
  jest.useRealTimers();
});

describe("the pose channel", () => {
  it("joins with the token and the credentials' project, and no key", async () => {
    await expect(
      joinColocation({ roomId: "room-1", apiKey: "k", credentials: tokenCredentials() })
    ).resolves.toEqual({ success: true });

    expect(native.setAccessToken).toHaveBeenCalledWith("u1");
    expect(native.join).toHaveBeenCalledWith("room-1", "", "p", "");
    expect(native.setAccessToken.mock.invocationCallOrder[0]).toBeLessThan(
      native.join.mock.invocationCallOrder[0]
    );
  });

  it("is handed a renewed token two minutes before the one it has expires, until it leaves", async () => {
    const fetchToken = backend();
    await joinColocation({ roomId: "room-1", credentials: tokenCredentials(fetchToken) });

    await jest.advanceTimersByTimeAsync(3480 * S - 1);
    await flush();
    expect(native.setAccessToken.mock.calls).toEqual([["u1"]]);

    await jest.advanceTimersByTimeAsync(1);
    await flush();
    expect(native.setAccessToken.mock.calls).toEqual([["u1"], ["u2"]]);

    await leaveColocation();
    expect(native.leave).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(10 * 3600 * S);
    await flush();
    expect(native.setAccessToken.mock.calls).toEqual([["u1"], ["u2"]]);
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it("is handed at once a token another call renewed", async () => {
    const credentials = tokenCredentials();
    await joinColocation({ roomId: "room-1", credentials });

    // As a room helper does after a 401.
    await credentials({ refusedToken: "u1" });
    await flush();
    expect(native.setAccessToken.mock.calls).toEqual([["u1"], ["u2"]]);
  });

  it("stops renewing once the credentials are cleared", async () => {
    const fetchToken = backend();
    const credentials = tokenCredentials(fetchToken);
    await joinColocation({ roomId: "room-1", credentials });

    credentials.clear();
    // Fetched after sign-out, so it is the next user's and not this channel's.
    await credentials();
    await jest.advanceTimersByTimeAsync(10 * 3600 * S);
    await flush();
    expect(native.setAccessToken.mock.calls).toEqual([["u1"]]);
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it("does not join once a leave or a later join overtakes the credentials fetch", async () => {
    const releases: ((answer: unknown) => void)[] = [];
    const slow = () =>
      tokenCredentials(jest.fn(() => new Promise<any>((r) => releases.push(r))));

    const left = joinColocation({ roomId: "room-1", credentials: slow() });
    await flush();
    await leaveColocation();
    const overtaken = joinColocation({ roomId: "room-1", credentials: slow() });
    await flush();
    await joinColocation({ roomId: "room-2", apiKey: "k", projectId: "p" });

    releases.forEach((release) => release({ token: "late", expires_in: 3600 }));
    await expect(left).resolves.toMatchObject({ success: false });
    await expect(overtaken).resolves.toMatchObject({ success: false });
    expect(native.setAccessToken).not.toHaveBeenCalled();
    expect(native.join.mock.calls).toEqual([["room-2", "k", "p", ""]]);
  });

  it("does not join once a later join overtakes handing native the token, and that join clears it", async () => {
    let release: (set: boolean) => void = () => {};
    native.setAccessToken.mockImplementationOnce(() => new Promise((r) => (release = r)));
    const overtaken = joinColocation({ roomId: "room-1", credentials: tokenCredentials() });
    await flush();
    const later = joinColocation({ roomId: "room-2", apiKey: "k", projectId: "p" });

    release(true);
    await expect(overtaken).resolves.toMatchObject({ success: false });
    await expect(later).resolves.toEqual({ success: true });
    expect(native.setAccessToken.mock.calls).toEqual([["u1"], [""]]);
    expect(native.join.mock.calls).toEqual([["room-2", "k", "p", ""]]);
  });

  it("renews a token from another function by its own exp, where there is no atob", async () => {
    const atob = globalThis.atob;
    (globalThis as any).atob = undefined;
    const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const jwt = (n: number) =>
      `rv_ut_${part({ alg: "HS256" })}.${part({ iat: 1000 + n, exp: 1600 + n })}.sig`;
    let n = 0;
    const credentials = jest.fn(async () => ({ projectId: "p", accessToken: jwt(n++) }));
    await joinColocation({ roomId: "room-1", credentials });

    // exp is at 1600 s and the clock at 1000 s: renewed 120 s before, at 1480 s.
    await jest.advanceTimersByTimeAsync(480 * S);
    await flush();
    expect(native.setAccessToken.mock.calls).toEqual([[jwt(0)], [jwt(1)]]);
    globalThis.atob = atob;
  });

  it("joins as today without credentials, and clears a token an earlier join left", async () => {
    await joinColocation({ roomId: "room-1", apiKey: "k", projectId: "p" });
    expect(native.join).toHaveBeenLastCalledWith("room-1", "k", "p", "");
    expect(native.setAccessToken).not.toHaveBeenCalled();

    await joinColocation({ roomId: "room-1", credentials: tokenCredentials() });
    await joinColocation({ roomId: "room-2", apiKey: "k", projectId: "p" });
    expect(native.setAccessToken.mock.calls).toEqual([["u1"], [""]]);
    expect(native.join).toHaveBeenLastCalledWith("room-2", "k", "p", "");
  });

  it("joins with a key the credentials give", async () => {
    await joinColocation({ roomId: "room-1", credentials: { projectId: "p", apiKey: "k" } });
    expect(native.join).toHaveBeenCalledWith("room-1", "k", "p", "");
    expect(native.setAccessToken).not.toHaveBeenCalled();
  });

  it("does not join with a token on a native build that cannot take one", async () => {
    native.setAccessToken.mockResolvedValue(false);
    const result = await joinColocation({ roomId: "room-1", credentials: tokenCredentials() });
    expect(result.success).toBe(false);
    expect(native.join).not.toHaveBeenCalled();
  });

  it("does not join when the credentials fail", async () => {
    const credentials = jest.fn(async () => {
      throw new Error("backend down");
    });
    await expect(joinColocation({ roomId: "room-1", credentials })).resolves.toEqual({
      success: false,
      error: "Could not get credentials: backend down",
    });
    expect(native.join).not.toHaveBeenCalled();
  });
});

describe("the room helpers", () => {
  const ENDPOINT = "http://studio.test";
  const ROOM = { id: "r1", room_id: "r1", join_code: "K7M2QX", frame_kind: "cloud_anchor" };
  const refused = (status: number, code: string) => answer(status, { error: { code, message: code } });

  it.each(["APP_USER_TOKEN_EXPIRED", "INVALID_APP_USER_TOKEN"])(
    "send the token in place of the key, and after 401 %s send the request once more with a new one",
    async (code) => {
      fetchSpy
        .mockResolvedValueOnce(refused(401, code))
        .mockResolvedValueOnce(answer(201, { room: ROOM }));

      const result = await createColocationRoom(
        { endpoint: ENDPOINT, apiKey: "k", credentials: tokenCredentials() },
        { frameKind: "cloud_anchor", cloudAnchorId: "a1" }
      );

      expect(result).toMatchObject({ success: true, room: { joinCode: "K7M2QX" } });
      expect(sentHeaders(0)).toEqual({
        "content-type": "application/json",
        authorization: "Bearer u1",
        "x-project-id": "p",
      });
      expect(sentHeaders(1).authorization).toBe("Bearer u2");
      expect(fetchSpy.mock.calls[1][1].body).toBe(fetchSpy.mock.calls[0][1].body);
    }
  );

  it("send the request once more at most", async () => {
    fetchSpy.mockResolvedValue(refused(401, "APP_USER_TOKEN_EXPIRED"));
    const result = await lookupColocationRoom(
      { endpoint: ENDPOINT, credentials: tokenCredentials() },
      "K7M2QX"
    );
    expect(result).toMatchObject({ success: false, code: "APP_USER_TOKEN_EXPIRED", status: 401 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it.each(["APP_USER_TOKEN_SCOPE_NOT_ALLOWED", "APP_USER_TOKEN_REQUIRED", "APP_USER_MISMATCH"])(
    "do not send the request again after 403 %s",
    async (code) => {
      const fetchToken = backend();
      fetchSpy.mockResolvedValue(refused(403, code));
      const result = await lookupColocationRoom(
        { endpoint: ENDPOINT, projectId: "p2", credentials: tokenCredentials(fetchToken) },
        "K7M2QX"
      );
      expect(result).toMatchObject({ success: false, code, status: 403 });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(sentHeaders(0)["x-project-id"]).toBe("p2");
      expect(fetchToken).toHaveBeenCalledTimes(1);
    }
  );

  it("send a key the credentials give, in place of headers", async () => {
    fetchSpy.mockResolvedValue(answer(200, { room: ROOM }));
    await lookupColocationRoom(
      {
        endpoint: ENDPOINT,
        headers: { Authorization: "Bearer session" },
        credentials: { projectId: "p", apiKey: "k" },
      },
      "K7M2QX"
    );
    expect(sentHeaders(0)).toEqual({
      "content-type": "application/json",
      "x-api-key": "k",
      "x-project-id": "p",
    });
  });

  it("send nothing when the credentials fail", async () => {
    const credentials = jest.fn(async () => {
      throw new Error("backend down");
    });
    const result = await lookupColocationRoom({ endpoint: ENDPOINT, credentials }, "K7M2QX");
    expect(result).toMatchObject({ success: false, code: "CREDENTIALS_UNAVAILABLE" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("the replication client", () => {
  class FakeSocket {
    static last: FakeSocket;
    onopen: (() => void) | null = null;
    onmessage: ((ev: { data: unknown }) => void) | null = null;
    onclose: ((ev: unknown) => void) | null = null;
    onerror: ((ev: unknown) => void) | null = null;
    constructor(
      public url: string,
      _protocols: null,
      public options: { headers: Record<string, string> }
    ) {
      FakeSocket.last = this;
    }
    close() {}
    send() {}
    // React Native 0.86 sends a bare error and the text as the close's reason;
    // older versions put it on the error as `message`.
    refuse(message: string, older = false) {
      this.onerror?.(older ? { message } : {});
      this.onclose?.(older ? { code: 1006 } : { code: 1006, reason: message });
    }
  }

  let client: ViroReplicationClient;
  beforeEach(() => {
    (globalThis as any).WebSocket = FakeSocket;
    client = new ViroReplicationClient();
  });
  afterEach(() => client.disconnect());

  it("sends the token in place of the key, and asks for a new one once after a 401 handshake", async () => {
    const fetchToken = backend();
    client.connect({
      roomId: "room-1",
      endpoint: "http://relay.test",
      apiKey: "k",
      credentials: tokenCredentials(fetchToken),
    });
    await flush();
    expect(FakeSocket.last.options.headers).toMatchObject({
      Authorization: "Bearer u1",
      "x-project-id": "p",
    });
    expect(FakeSocket.last.options.headers).not.toHaveProperty("x-api-key");

    FakeSocket.last.refuse("Expected HTTP 101 response but was '401 Unauthorized'");
    await jest.advanceTimersByTimeAsync(500);
    await flush();
    expect(FakeSocket.last.options.headers.Authorization).toBe("Bearer u2");

    // Once: a second refusal reconnects with the token it has.
    FakeSocket.last.refuse("Received bad response code from server: 401.");
    await jest.advanceTimersByTimeAsync(1000);
    await flush();
    expect(FakeSocket.last.options.headers.Authorization).toBe("Bearer u2");
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it("reads a 401 off the error event of an older React Native", async () => {
    const fetchToken = backend();
    client.connect({ roomId: "room-1", endpoint: "http://relay.test", credentials: tokenCredentials(fetchToken) });
    await flush();

    FakeSocket.last.refuse("Expected HTTP 101 response but was '401 Unauthorized'", true);
    await jest.advanceTimersByTimeAsync(500);
    await flush();
    expect(FakeSocket.last.options.headers.Authorization).toBe("Bearer u2");
  });

  it("keeps the token on a drop that is not a 401", async () => {
    const fetchToken = backend();
    client.connect({ roomId: "room-1", endpoint: "http://relay.test", credentials: tokenCredentials(fetchToken) });
    await flush();

    FakeSocket.last.refuse("The network connection was lost.");
    await jest.advanceTimersByTimeAsync(500);
    await flush();
    expect(FakeSocket.last.options.headers.Authorization).toBe("Bearer u1");
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it("sends the key alone without credentials, as before", async () => {
    client.connect({ roomId: "room-1", endpoint: "http://relay.test", apiKey: "k", projectId: "p" });
    await flush();
    expect(FakeSocket.last.options.headers).toMatchObject({ "x-api-key": "k", "x-project-id": "p" });
    expect(FakeSocket.last.options.headers).not.toHaveProperty("Authorization");
  });
});
