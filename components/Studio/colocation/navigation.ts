import {
  ChangeListeners,
  type StudioChangeOrigin,
  type StudioStoreChangeListener,
} from "../domain/utils";

export const STUDIO_COLOCATION_CURRENT_SCENE_ENTITY = "scene:current";

/**
 * `scene:current`: the scene every device in the room shows. `n` counts the
 * room's navigations, so going to the scene already on screen is still one. It
 * is null for a joiner's own scene before it has read the room's.
 */
export type StudioRoomScene = { sceneId: string; n: number | null };

/**
 * This device's copy of `scene:current`, for one session. A local set is this
 * device navigating and is written to the room; a remote one is the room
 * navigating and reaches `onRemote`, which follows it.
 */
export class StudioRoomSceneStore {
  private changes = new ChangeListeners();

  constructor(
    private value: StudioRoomScene,
    private onRemote: (next: StudioRoomScene, prev: StudioRoomScene) => void
  ) {}

  get(): StudioRoomScene {
    return this.value;
  }

  set(next: StudioRoomScene, origin: StudioChangeOrigin = "local"): void {
    const prev = this.value;
    if (prev.sceneId === next.sceneId && prev.n === next.n) return;
    this.value = next;
    this.changes.notify("", origin);
    if (origin === "remote") this.onRemote(next, prev);
  }

  /** The one key is "". */
  subscribeChanges(listener: StudioStoreChangeListener): () => void {
    return this.changes.subscribe(listener);
  }
}

/**
 * Whether a device whose copy was `prev` has to change scenes for `next`. A
 * joiner already on the room's scene stays, whatever the room's count says.
 */
export function roomSceneNeedsNavigation(
  prev: StudioRoomScene,
  next: StudioRoomScene
): boolean {
  if (prev.sceneId !== next.sceneId) return true;
  return prev.n !== null && prev.n !== next.n;
}
