/**
 * Best-effort haptics, for a Viro app that also runs on visionOS.
 *
 * The Expo modules are not linked on visionOS — that platform's Podfile installs React Native and
 * Viro, not Expo — so every `expo-haptics` call there rejects with "not available on ios", which
 * arrives as an uncaught promise rejection on every single tap. Feedback is not something a screen
 * should fail over, and there is no haptic engine to fall back to on a headset anyway.
 *
 * The rejection is swallowed rather than branched on `Platform.OS`: the visionOS bundle is built
 * with `platform=ios`, so the platform check would read the wrong answer, and a missing native
 * module is the same non-event wherever it happens.
 */
import * as Haptics from 'expo-haptics';

export const ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = Haptics.NotificationFeedbackType;

function ignore(): void {}

export function impactAsync(style?: Haptics.ImpactFeedbackStyle): Promise<void> {
  try {
    return Haptics.impactAsync(style).catch(ignore);
  } catch {
    return Promise.resolve();
  }
}

export function selectionAsync(): Promise<void> {
  try {
    return Haptics.selectionAsync().catch(ignore);
  } catch {
    return Promise.resolve();
  }
}

export function notificationAsync(
  type?: Haptics.NotificationFeedbackType
): Promise<void> {
  try {
    return Haptics.notificationAsync(type).catch(ignore);
  } catch {
    return Promise.resolve();
  }
}
