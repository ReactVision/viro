/**
 * A Quest plane scene's spatial data prompt.
 *
 * The headset view opens before the opening scene is fetched, so the session's
 * first plane scene asks from inside it, whether it opened the session, a
 * NAVIGATE reached it or a shared session left it. What is tested here: such a
 * scene asks once per session, never when it may not ask, and every scene
 * waiting on the prompt gets its answer.
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
  startQuestSpatialDataSession();
  await expect(questSpatialDataGranted(true)).resolves.toBe(true);
  expect(mockRequest).not.toHaveBeenCalled();
});

test("the first plane scene of a session that has not asked asks once", async () => {
  mockRequest.mockResolvedValue({ [USE_SCENE]: "granted" });
  startQuestSpatialDataSession();
  await expect(questSpatialDataGranted(true)).resolves.toBe(true);
  expect(mockRequest).toHaveBeenCalledWith([
    "horizonos.permission.USE_ANCHOR_API",
    USE_SCENE,
  ]);
});

test("a declined prompt is not shown again in the same session", async () => {
  startQuestSpatialDataSession();
  await expect(questSpatialDataGranted(true)).resolves.toBe(false);
  await expect(questSpatialDataGranted(true)).resolves.toBe(false);
  expect(mockRequest).toHaveBeenCalledTimes(1);
});

test("a scene that may not ask only checks", async () => {
  startQuestSpatialDataSession();
  await expect(questSpatialDataGranted(false)).resolves.toBe(false);
  expect(mockRequest).not.toHaveBeenCalled();
  // The session can still ask later, from a scene that may.
  await questSpatialDataGranted(true);
  expect(mockRequest).toHaveBeenCalledTimes(1);
});

test("plane scenes asking at once share one prompt", async () => {
  mockRequest.mockResolvedValue({ [USE_SCENE]: "granted" });
  startQuestSpatialDataSession();
  await expect(
    Promise.all([questSpatialDataGranted(true), questSpatialDataGranted(true)])
  ).resolves.toEqual([true, true]);
  expect(mockRequest).toHaveBeenCalledTimes(1);
});

test("a new session may ask again", async () => {
  startQuestSpatialDataSession();
  await questSpatialDataGranted(true);
  startQuestSpatialDataSession();
  await questSpatialDataGranted(true);
  expect(mockRequest).toHaveBeenCalledTimes(2);
});
