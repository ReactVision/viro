/**
 * A Quest plane scene's spatial data prompt.
 *
 * The navigator asks before the headset view opens when the opening scene
 * detects planes. A plane scene reached by NAVIGATE from one that does not had
 * no way to ask, so it never got the room's planes. What is tested here: such a
 * scene asks once per session, never after the launch asked, and never when it
 * may not ask.
 */
const mockCheck = jest.fn();
const mockRequest = jest.fn();

jest.mock("react-native", () => ({
  PermissionsAndroid: {
    check: (...args: unknown[]) => mockCheck(...args),
    requestMultiple: (...args: unknown[]) => mockRequest(...args),
    RESULTS: { GRANTED: "granted", DENIED: "denied" },
  },
}));

import {
  questSpatialDataGranted,
  startQuestSpatialDataSession,
} from "../components/Studio/domain/questSpatialData";

const USE_SCENE = "com.oculus.permission.USE_SCENE";

beforeEach(() => {
  mockCheck.mockReset().mockResolvedValue(false);
  mockRequest.mockReset().mockResolvedValue({ [USE_SCENE]: "denied" });
});

test("a granted permission is not asked for", async () => {
  mockCheck.mockResolvedValue(true);
  startQuestSpatialDataSession(false);
  await expect(questSpatialDataGranted(true)).resolves.toBe(true);
  expect(mockRequest).not.toHaveBeenCalled();
});

test("the first plane scene of a session that has not asked asks once", async () => {
  mockRequest.mockResolvedValue({ [USE_SCENE]: "granted" });
  startQuestSpatialDataSession(false);
  await expect(questSpatialDataGranted(true)).resolves.toBe(true);
  expect(mockRequest).toHaveBeenCalledWith([
    "horizonos.permission.USE_ANCHOR_API",
    USE_SCENE,
  ]);
});

test("a declined prompt is not shown again in the same session", async () => {
  startQuestSpatialDataSession(false);
  await expect(questSpatialDataGranted(true)).resolves.toBe(false);
  await expect(questSpatialDataGranted(true)).resolves.toBe(false);
  expect(mockRequest).toHaveBeenCalledTimes(1);
});

test("a session whose launch asked does not ask again", async () => {
  startQuestSpatialDataSession(true);
  await expect(questSpatialDataGranted(true)).resolves.toBe(false);
  expect(mockRequest).not.toHaveBeenCalled();
});

test("a scene that may not ask only checks", async () => {
  startQuestSpatialDataSession(false);
  await expect(questSpatialDataGranted(false)).resolves.toBe(false);
  expect(mockRequest).not.toHaveBeenCalled();
  // The session can still ask later, from a scene that may.
  await questSpatialDataGranted(true);
  expect(mockRequest).toHaveBeenCalledTimes(1);
});

test("a new session may ask again", async () => {
  startQuestSpatialDataSession(false);
  await questSpatialDataGranted(true);
  startQuestSpatialDataSession(false);
  await questSpatialDataGranted(true);
  expect(mockRequest).toHaveBeenCalledTimes(2);
});
