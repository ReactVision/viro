import type { Vec3 } from "../colocation/frameMath";
export type StudioDragMoveListener = (assetId: string, worldPosition: Vec3) => void;
/**
 * Per-scene drag state a shared session drives, keyed by asset placement id:
 * where another device dragged an asset (scene-frame coordinates) and whether
 * another device holds it now. Per-asset listeners, so a drag elsewhere
 * repaints the one node it moves rather than the scene.
 *
 * Drags on this device only pass through (`moved`). The renderer already moves
 * the node, and feeding its position back as a prop would pull it behind the
 * finger.
 */
export declare class StudioDragStore {
    private positions;
    private locked;
    private revisions;
    private keyed;
    private moves;
    getPosition(assetId: string): Vec3 | undefined;
    isLocked(assetId: string): boolean;
    /** Bumped by a forced apply that did not move the position. */
    revision(assetId: string): number;
    subscribe(assetId: string, listener: () => void): () => void;
    /**
     * Another device's drag. No position leaves the asset where the scene put
     * it. `force` repaints an unchanged position, for a node this device moved
     * itself while its drag was being refused.
     */
    applyRemote(assetId: string, position: Vec3 | undefined, locked: boolean, force?: boolean): void;
    /** This device dragged the asset to a world position. */
    moved(assetId: string, worldPosition: Vec3): void;
    subscribeMoves(listener: StudioDragMoveListener): () => void;
    /** Every asset back where the scene puts it, held by nobody. */
    reset(): void;
}
