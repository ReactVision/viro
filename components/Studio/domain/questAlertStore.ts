import { GlobalListeners } from "./utils";

/**
 * Quest has no 2D overlay surface, so ALERT (and the TAKE_PHOTO failure
 * alert, which shares this path) can't show a native Alert.alert dialog the
 * way phones do. This module singleton is the single active message; the
 * ALERT dispatch arm in sceneNavigationHandler writes it, and
 * StudioQuestAlertOverlay subscribes to render it in-scene, head-locked.
 */
class QuestAlertStore {
  private activeTitle: string | null = null;
  private activeMessage: string | null = null;
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

  subscribe(listener: () => void): () => void {
    return this.listeners.subscribe(listener);
  }

  show(title: string, message: string): void {
    this.activeTitle = title || null;
    this.activeMessage = message;
    this.listeners.notify();
  }

  dismiss(): void {
    if (this.activeMessage === null) return;
    this.activeTitle = null;
    this.activeMessage = null;
    this.listeners.notify();
  }

  /** Force idle so a torn-down scene can't wedge an alert on for the next one. */
  reset(): void {
    this.dismiss();
  }
}

export const questAlertStore = new QuestAlertStore();
