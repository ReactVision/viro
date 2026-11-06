// A device id that native failed to give once is asked for again by the next
// socket instead of staying null for the process.
const mockGetDeviceId = jest.fn();

jest.mock("react-native", () => ({
  Platform: { OS: "ios", constants: {} },
  NativeModules: { VRTColocationModule: { getDeviceId: () => mockGetDeviceId() } },
}));

import { colocationDeviceIdNow } from "../components/AR/ViroColocation";

it("does not keep a null from a failed call", async () => {
  mockGetDeviceId.mockRejectedValueOnce(new Error("bridge busy"));
  await expect(colocationDeviceIdNow()).resolves.toBeNull();

  mockGetDeviceId.mockResolvedValueOnce("device-1");
  await expect(colocationDeviceIdNow()).resolves.toBe("device-1");
  expect(colocationDeviceIdNow()).toBe("device-1");
});
