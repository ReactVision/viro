import { GlobalListeners } from "./utils";

/** A button the host adds to the Quest in-scene menu. */
export type StudioQuestMenuItem = {
  label: string;
  onPress: () => void;
};

/** Who writes to the store: each navigator passes a token of its own. */
export type StudioQuestMenuOwner = object;

const NO_ITEMS: readonly StudioQuestMenuItem[] = [];

/**
 * The navigator's `questMenuItems`, for the menu in StudioQuestSceneHudOverlay.
 * The scene runs in VRActivity's React root, which the navigator's props never
 * reach, so they cross here. The latest navigator to write owns the items, and
 * an older one unmounting leaves them alone.
 */
class QuestMenuStore {
  private items: readonly StudioQuestMenuItem[] = NO_ITEMS;
  private owner: StudioQuestMenuOwner | null = null;
  private listeners = new GlobalListeners();

  getItems(): readonly StudioQuestMenuItem[] {
    return this.items;
  }

  subscribe(listener: () => void): () => void {
    return this.listeners.subscribe(listener);
  }

  set(
    items: readonly StudioQuestMenuItem[] | undefined,
    owner: StudioQuestMenuOwner
  ): void {
    this.owner = owner;
    const next = items ?? NO_ITEMS;
    if (this.items === next) return;
    this.items = next;
    this.listeners.notify();
  }

  clear(owner: StudioQuestMenuOwner): void {
    if (this.owner !== owner) return;
    this.owner = null;
    if (this.items === NO_ITEMS) return;
    this.items = NO_ITEMS;
    this.listeners.notify();
  }
}

export const questMenuStore = new QuestMenuStore();
