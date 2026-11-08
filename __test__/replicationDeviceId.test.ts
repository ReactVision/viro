import { ViroReplicationClient } from "../components/AR/ViroReplication";

// The relay bills a device once across its pose and replication sockets only
// when both name the same device, so the replication socket sends the id the
// native channel sends.
const mockGetDeviceId = jest.fn(async () => "6f2800dc-a904-4f48-979d-02afb80c66be");

jest.mock("react-native", () => ({
  Platform: { OS: "ios", constants: {} },
  NativeModules: { VRTColocationModule: { getDeviceId: () => mockGetDeviceId() } },
}));

class FakeSocket {
  static all: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 0;

  constructor(
    public url: string,
    _protocols?: null,
    public options?: { headers?: Record<string, string> }
  ) {
    FakeSocket.all.push(this);
  }

  send() {}
  close() {
    this.readyState = 3;
  }
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => {
  (globalThis as any).WebSocket = FakeSocket;
  FakeSocket.all = [];
});

it("sends the native channel's device id, asking native only once", async () => {
  const first = new ViroReplicationClient();
  first.connect({ roomId: "room-1", apiKey: "k", projectId: "p" });
  // The first socket waits for the native answer.
  expect(FakeSocket.all).toHaveLength(0);
  await settle();
  expect(FakeSocket.all[0].options?.headers?.["x-rv-device"]).toBe(
    "6f2800dc-a904-4f48-979d-02afb80c66be"
  );

  // Known from then on, so the next socket opens at once with it.
  const second = new ViroReplicationClient();
  second.connect({ roomId: "room-2", apiKey: "k", projectId: "p" });
  expect(FakeSocket.all[1].options?.headers?.["x-rv-device"]).toBe(
    "6f2800dc-a904-4f48-979d-02afb80c66be"
  );
  expect(mockGetDeviceId).toHaveBeenCalledTimes(1);

  first.disconnect();
  second.disconnect();
});
