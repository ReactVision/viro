/**
 * Copyright © 2026 ReactVision
 *
 * When the co-location hooks join again for new credentials: for another
 * createUserTokenCredentials() object and at its clear(), never for a
 * credentials function that is new every render. The joins, sockets and room
 * requests are mocked; only the hooks' keying is under test.
 */
jest.mock("../components/Studio/VRTStudioModule", () => ({ VRTStudioModule: {} }));

const mockJoin = jest.fn();
const mockLeave = jest.fn();
jest.mock("../components/AR/ViroColocation", () => ({
  isColocationAvailable: async () => true,
  joinColocation: (config: unknown) => mockJoin(config),
  leaveColocation: async () => mockLeave(),
  getColocationState: async () => ({ state: "joined", localPeerId: "me" }),
  getColocationPeers: async () => [],
  setColocationLocalPose: async () => {},
}));

const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
jest.mock("../components/AR/ViroReplication", () => ({
  ViroReplicationClient: class {
    state = "idle";
    localPeerId = "";
    error = undefined;
    connect(config: unknown) {
      mockConnect(config);
    }
    disconnect() {
      mockDisconnect();
    }
    subscribe() {
      return () => {};
    }
    getEntities() {
      return [];
    }
    get() {
      return undefined;
    }
  },
}));

jest.mock("../components/AR/ViroFrameSource", () => ({
  cloudAnchorFrameSource: jest.fn(),
  metaSpatialAnchorFrameSource: jest.fn(),
  visionOSSharedSpaceFrameSource: jest.fn(),
}));

const mockLookup = jest.fn();
jest.mock("../components/AR/ViroColocationRooms", () => ({
  lookupColocationRoom: (config: unknown, code: string) => mockLookup(config, code),
  createColocationRoom: jest.fn(),
  formatJoinCode: (code: string) => code,
}));

import * as React from "react";
import TestRenderer, { act, ReactTestRenderer } from "react-test-renderer";
import { createUserTokenCredentials } from "../components/AR/ViroUserTokenCredentials";
import { useViroColocation } from "../components/hooks/useViroColocation";
import { useViroColocationRoom } from "../components/hooks/useViroColocationRoom";
import { useViroReplicatedState } from "../components/hooks/useViroReplicatedState";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const userCredentials = () =>
  createUserTokenCredentials({ projectId: "p", fetchToken: async () => "rv_ut_a.b.c" });

function Probe({ hook, props, out }: { hook: (p: any) => unknown; props: any; out: { current: any } }) {
  out.current = hook(props);
  return null;
}

// Unmounted after each test, so a failed one leaves no poll running.
const mounted: ReactTestRenderer[] = [];

async function mount(hook: (p: any) => unknown, props: any) {
  const out = { current: undefined as any };
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<Probe hook={hook} props={props} out={out} />);
  });
  mounted.push(renderer);
  return {
    out,
    update: (next: any) =>
      act(async () => {
        renderer.update(<Probe hook={hook} props={next} out={out} />);
      }),
  };
}

let consoleErrorSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  mockJoin.mockResolvedValue({ success: true });
  // react-test-renderer announces its own deprecation on every create(); any
  // other console.error still prints.
  const original = console.error;
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("react-test-renderer is deprecated")) return;
    original(...args);
  });
});
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((renderer) => renderer.unmount()));
  consoleErrorSpy.mockRestore();
});

describe("useViroReplicatedState", () => {
  it("reconnects for another user's credentials and at clear(), not for a function new every render", async () => {
    const a = userCredentials();
    const hook = await mount(useViroReplicatedState, { roomId: "r", credentials: a });
    expect(mockConnect).toHaveBeenCalledTimes(1);

    await hook.update({ roomId: "r", credentials: a });
    expect(mockConnect).toHaveBeenCalledTimes(1);

    await act(async () => a.clear());
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(mockConnect).toHaveBeenCalledTimes(2);

    const b = userCredentials();
    await hook.update({ roomId: "r", credentials: b });
    expect(mockConnect).toHaveBeenCalledTimes(3);
    // The first user's credentials no longer reach the socket.
    await act(async () => a.clear());
    expect(mockConnect).toHaveBeenCalledTimes(3);

    await hook.update({ roomId: "r", credentials: () => ({ projectId: "p", apiKey: "k" }) });
    expect(mockConnect).toHaveBeenCalledTimes(4);
    await hook.update({ roomId: "r", credentials: () => ({ projectId: "p", apiKey: "k" }) });
    expect(mockConnect).toHaveBeenCalledTimes(4);

  });
});

describe("useViroColocation", () => {
  it("leaves and joins again at clear()", async () => {
    const a = userCredentials();
    await mount(useViroColocation, { roomId: "r", credentials: a, pollMs: 60_000 });
    expect(mockJoin).toHaveBeenCalledTimes(1);

    await act(async () => a.clear());
    expect(mockLeave).toHaveBeenCalledTimes(1);
    expect(mockJoin).toHaveBeenCalledTimes(2);
    expect(mockJoin.mock.calls[1][0]).toMatchObject({ roomId: "r", credentials: a });

  });
});

describe("useViroColocationRoom", () => {
  it("sends a failed lookup again for another user's credentials, and keeps a room it found", async () => {
    mockLookup
      .mockResolvedValueOnce({ success: false, error: "refused" })
      .mockResolvedValueOnce({
        success: true,
        room: { roomId: "room-1", joinCode: "ABC234", frameKind: "unknown" },
      });
    const a = userCredentials();
    const hook = await mount(useViroColocationRoom, { credentials: a, joinCode: "ABC234" });
    expect(mockLookup).toHaveBeenCalledTimes(1);
    expect(hook.out.current.status).toBe("failed");

    const b = userCredentials();
    await hook.update({ credentials: b, joinCode: "ABC234" });
    expect(mockLookup).toHaveBeenCalledTimes(2);
    expect(hook.out.current.roomId).toBe("room-1");

    await act(async () => b.clear());
    expect(mockLookup).toHaveBeenCalledTimes(2);
    expect(hook.out.current.status).toBe("ready");

  });
});
