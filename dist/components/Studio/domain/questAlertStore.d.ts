/**
 * Quest has no 2D overlay surface, so ALERT (and the TAKE_PHOTO failure
 * alert, which shares this path) can't show a native Alert.alert dialog the
 * way phones do. This module singleton is the single active message; the
 * ALERT dispatch arm in sceneNavigationHandler writes it, and
 * StudioQuestAlertOverlay subscribes to render it in-scene, head-locked.
 */
declare class QuestAlertStore {
    private activeTitle;
    private activeMessage;
    private listeners;
    isActive(): boolean;
    title(): string | null;
    message(): string | null;
    subscribe(listener: () => void): () => void;
    show(title: string, message: string): void;
    dismiss(): void;
    /** Force idle so a torn-down scene can't wedge an alert on for the next one. */
    reset(): void;
}
export declare const questAlertStore: QuestAlertStore;
export {};
