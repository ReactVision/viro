import type { StudioSceneResponse } from "../types";
import { GlobalListeners } from "./utils";

export type StudioQuestSceneLoad =
  | { status: "loading" }
  | { status: "ready"; sceneData: StudioSceneResponse }
  | { status: "failed" };

/** Who writes to the store: each navigator passes a token of its own. */
export type StudioQuestSceneLoadOwner = object;

export const QUEST_SCENE_LOADING: StudioQuestSceneLoad = { status: "loading" };

/**
 * The opening scene's data on Meta Quest. VRActivity launches before the scene
 * is fetched, and the scene it is given at launch is fixed and replayed on
 * every re-entry, so the data crosses here. Only the navigator that opened last
 * writes, and its state outlives a re-entry.
 */
class QuestSceneLoadStore {
  private state: StudioQuestSceneLoad = QUEST_SCENE_LOADING;
  private owner: StudioQuestSceneLoadOwner | null = null;
  private retryHandler: (() => void) | null = null;
  private listeners = new GlobalListeners();

  get(): StudioQuestSceneLoad {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    return this.listeners.subscribe(listener);
  }

  open(owner: StudioQuestSceneLoadOwner, retry: () => void): void {
    this.owner = owner;
    this.retryHandler = retry;
    this.update(QUEST_SCENE_LOADING);
  }

  set(owner: StudioQuestSceneLoadOwner, state: StudioQuestSceneLoad): void {
    if (this.owner === owner) this.update(state);
  }

  retry(): void {
    const handler = this.retryHandler;
    if (!handler) return;
    this.update(QUEST_SCENE_LOADING);
    handler();
  }

  /**
   * Keeps the state and does not notify: the scene a closing navigator opened
   * goes on showing it until VRActivity finishes. The retry handler would hold
   * the unmounted navigator.
   */
  close(owner: StudioQuestSceneLoadOwner): void {
    if (this.owner !== owner) return;
    this.owner = null;
    this.retryHandler = null;
  }

  private update(state: StudioQuestSceneLoad): void {
    if (this.state === state) return;
    this.state = state;
    this.listeners.notify();
  }
}

export const questSceneLoadStore = new QuestSceneLoadStore();
