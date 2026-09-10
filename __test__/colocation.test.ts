// Built inside the factory: jest.mock is hoisted above every const, so a
// module-scope object would still be in its temporal dead zone when the
// factory runs.
jest.mock("react-native", () => ({
  NativeModules: {
    VRTColocationModule: {
      isAvailable: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      setLocalPose: jest.fn(),
      getState: jest.fn(),
      getPeers: jest.fn(),
    },
  },
}));

import { NativeModules } from "react-native";
const mockModule = (NativeModules as any).VRTColocationModule;

import {
  getColocationPeers,
  getColocationState,
  isColocationAvailable,
  joinColocation,
  setColocationLocalPose,
} from "../components/AR/ViroColocation";

beforeEach(() => jest.clearAllMocks());

describe("channel availability", () => {
  it("reports what native says", async () => {
    mockModule.isAvailable.mockResolvedValue(true);
    expect(await isColocationAvailable()).toBe(true);
  });
});

describe("join", () => {
  it("passes the room and credentials through, defaulting the endpoint", async () => {
    mockModule.join.mockResolvedValue({ success: true });
    await joinColocation({ roomId: "room-1", apiKey: "k", projectId: "p" });
    // Empty string, not undefined: the native signature takes four strings.
    expect(mockModule.join).toHaveBeenCalledWith("room-1", "k", "p", "");
  });

  it("carries a failure through instead of throwing", async () => {
    mockModule.join.mockResolvedValue({ success: false, error: "room full" });
    expect(await joinColocation({ roomId: "r", apiKey: "k", projectId: "p" }))
      .toEqual({ success: false, error: "room full" });
  });
});

describe("state", () => {
  it("maps the native ordinal onto the enum", async () => {
    mockModule.getState.mockResolvedValue({ state: 2, localPeerId: "abc" });
    expect(await getColocationState()).toEqual({ state: "joined", localPeerId: "abc" });
  });

  it("falls back to idle on an ordinal it does not know", async () => {
    // Forward compatibility: a newer native state must not read as undefined.
    mockModule.getState.mockResolvedValue({ state: 99, localPeerId: "" });
    expect((await getColocationState()).state).toBe("idle");
  });
});

describe("peers and poses", () => {
  it("returns the peer list as native gives it", async () => {
    const peer = {
      peerId: "p1",
      position: [1, 2, 3],
      rotation: [0, 0, 0, 1],
      timestampMs: 1757000000000,
      localized: true,
    };
    mockModule.getPeers.mockResolvedValue([peer]);
    expect(await getColocationPeers()).toEqual([peer]);
  });

  it("forwards the pose CSV untouched", async () => {
    mockModule.setLocalPose.mockResolvedValue(true);
    const csv = "1,0,0,0,0,1,0,0,0,0,1,0,2,0,3,1";
    await setColocationLocalPose(csv);
    expect(mockModule.setLocalPose).toHaveBeenCalledWith(csv);
  });
});

describe("no native module", () => {
  it("degrades to inert rather than throwing", async () => {
    jest.resetModules();
    jest.doMock("react-native", () => ({ NativeModules: {} }));
    const m = await import("../components/AR/ViroColocation");

    expect(await m.isColocationAvailable()).toBe(false);
    expect(await m.getColocationPeers()).toEqual([]);
    expect((await m.getColocationState()).state).toBe("idle");
    expect((await m.joinColocation({ roomId: "r", apiKey: "k", projectId: "p" })).success)
      .toBe(false);
    // These must not throw on a build without the channel.
    await m.setColocationLocalPose("1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1");
    await m.leaveColocation();
  });
});
