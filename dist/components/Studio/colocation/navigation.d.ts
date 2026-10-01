import { type StudioChangeOrigin, type StudioStoreChangeListener } from "../domain/utils";
export declare const STUDIO_COLOCATION_CURRENT_SCENE_ENTITY = "scene:current";
/**
 * `scene:current`: the scene every device in the room shows. `n` counts the
 * room's navigations, so going to the scene already on screen is still one. It
 * is null for a joiner's own scene before it has read the room's.
 */
export type StudioRoomScene = {
    sceneId: string;
    n: number | null;
};
/**
 * This device's copy of `scene:current`, for one session. A local set is this
 * device navigating and is written to the room; a remote one is the room
 * navigating and reaches `onRemote`, which follows it.
 */
export declare class StudioRoomSceneStore {
    private value;
    private onRemote;
    private changes;
    constructor(value: StudioRoomScene, onRemote: (next: StudioRoomScene, prev: StudioRoomScene) => void);
    get(): StudioRoomScene;
    set(next: StudioRoomScene, origin?: StudioChangeOrigin): void;
    /** The one key is "". */
    subscribeChanges(listener: StudioStoreChangeListener): () => void;
}
/**
 * Whether a device whose copy was `prev` has to change scenes for `next`. A
 * joiner already on the room's scene stays, whatever the room's count says.
 */
export declare function roomSceneNeedsNavigation(prev: StudioRoomScene, next: StudioRoomScene): boolean;
