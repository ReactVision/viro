import { PermissionsAndroid } from "react-native";

const USE_SCENE = "com.oculus.permission.USE_SCENE";
const SPATIAL_DATA = ["horizonos.permission.USE_ANCHOR_API", USE_SCENE];

let prompt: Promise<boolean> | null = null;

/**
 * Called as a navigator opens on Meta Quest. Its headset view opens before the
 * scene is known, so the session's first plane scene asks.
 */
export function startQuestSpatialDataSession(): void {
  prompt = null;
}

/**
 * Whether the wearer has granted spatial data, which the room's planes need.
 * With `mayAsk`, a session that has not asked yet asks now, and only once, so a
 * wearer who declined is not asked again by every plane scene. A scene that
 * checks while the prompt is open gets its answer.
 */
export async function questSpatialDataGranted(
  mayAsk: boolean
): Promise<boolean> {
  if (await PermissionsAndroid.check(USE_SCENE as any)) return true;
  if (prompt) return prompt;
  if (!mayAsk) return false;
  prompt = PermissionsAndroid.requestMultiple(SPATIAL_DATA as any).then(
    (results: Record<string, string>) =>
      results[USE_SCENE] === PermissionsAndroid.RESULTS.GRANTED
  );
  return prompt;
}
