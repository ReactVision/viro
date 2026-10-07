import { PermissionsAndroid } from "react-native";

const USE_SCENE = "com.oculus.permission.USE_SCENE";
const SPATIAL_DATA = ["horizonos.permission.USE_ANCHOR_API", USE_SCENE];

let asked = false;

/**
 * Called as a navigator opens on Meta Quest. Its headset view opens before the
 * scene is known, so the session's first plane scene asks.
 */
export function startQuestSpatialDataSession(): void {
  asked = false;
}

/**
 * Whether the wearer has granted spatial data, which the room's planes need.
 * With `mayAsk`, a session that has not asked yet asks now, and only once, so a
 * wearer who declined is not asked again by every plane scene.
 */
export async function questSpatialDataGranted(
  mayAsk: boolean
): Promise<boolean> {
  if (await PermissionsAndroid.check(USE_SCENE as any)) return true;
  if (!mayAsk || asked) return false;
  asked = true;
  const results: Record<string, string> =
    await PermissionsAndroid.requestMultiple(SPATIAL_DATA as any);
  return results[USE_SCENE] === PermissionsAndroid.RESULTS.GRANTED;
}
