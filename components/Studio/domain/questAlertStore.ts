import { Alert } from "react-native";
import { isQuest } from "../../Utilities/ViroPlatform";
import { GlobalListeners } from "./utils";

const DEFAULT_BUTTON_LABEL = "OK";

/**
 * Quest has no 2D overlay surface, so a scene's alerts can't show a native
 * Alert.alert dialog the way phones do. This module singleton is the single
 * active message; showStudioAlert writes it, and StudioQuestAlertOverlay
 * subscribes to render it in-scene, head-locked.
 */
class QuestAlertStore {
  private activeTitle: string | null = null;
  private activeMessage: string | null = null;
  private activeButtonLabel = DEFAULT_BUTTON_LABEL;
  private listeners = new GlobalListeners();

  isActive(): boolean {
    return this.activeMessage !== null;
  }

  title(): string | null {
    return this.activeTitle;
  }

  message(): string | null {
    return this.activeMessage;
  }

  buttonLabel(): string {
    return this.activeButtonLabel;
  }

  subscribe(listener: () => void): () => void {
    return this.listeners.subscribe(listener);
  }

  show(title: string, message: string, buttonLabel: string): void {
    this.activeTitle = title || null;
    this.activeMessage = message;
    this.activeButtonLabel = buttonLabel;
    this.listeners.notify();
  }

  dismiss(): void {
    if (this.activeMessage === null) return;
    this.activeTitle = null;
    this.activeMessage = null;
    this.activeButtonLabel = DEFAULT_BUTTON_LABEL;
    this.listeners.notify();
  }

  /** Force idle so a torn-down scene can't wedge an alert on for the next one. */
  reset(): void {
    this.dismiss();
  }
}

export const questAlertStore = new QuestAlertStore();

/**
 * Shows a Studio scene's alert: the ALERT function's, or a failure the wearer
 * has to know about. On Quest, Alert.alert's dialog is never drawn in the
 * headset and takes no controller input, so the in-scene panel shows it
 * instead. The button reads buttonLabel, or OK when it is empty.
 */
export function showStudioAlert(
  title: string,
  message: string,
  buttonLabel?: string | null
): void {
  const label = buttonLabel?.trim() || DEFAULT_BUTTON_LABEL;
  if (isQuest) {
    questAlertStore.show(title, message, label);
    return;
  }
  Alert.alert(title || "Alert", message, [{ text: label, style: "default" }]);
}
