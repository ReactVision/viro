import type { Vec3 } from "../colocation/frameMath";
import { KeyedListeners } from "./utils";

export type StudioDragMoveListener = (
  assetId: string,
  worldPosition: Vec3
) => void;

function samePosition(a: Vec3 | undefined, b: Vec3 | undefined): boolean {
  return a === b || (!!a && !!b && a.every((v, i) => v === b[i]));
}

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
export class StudioDragStore {
  private positions = new Map<string, Vec3>();
  private locked = new Set<string>();
  private revisions = new Map<string, number>();
  private keyed = new KeyedListeners();
  private moves = new Set<StudioDragMoveListener>();

  getPosition(assetId: string): Vec3 | undefined {
    return this.positions.get(assetId);
  }

  isLocked(assetId: string): boolean {
    return this.locked.has(assetId);
  }

  /** Bumped by a forced apply that did not move the position. */
  revision(assetId: string): number {
    return this.revisions.get(assetId) ?? 0;
  }

  subscribe(assetId: string, listener: () => void): () => void {
    return this.keyed.subscribe(assetId, listener);
  }

  /**
   * Another device's drag. No position leaves the asset where the scene put
   * it. `force` repaints an unchanged position, for a node this device moved
   * itself while its drag was being refused.
   */
  applyRemote(
    assetId: string,
    position: Vec3 | undefined,
    locked: boolean,
    force = false
  ): void {
    const moved = !samePosition(this.positions.get(assetId), position);
    if (!moved && this.locked.has(assetId) === locked && !force) return;
    if (position) this.positions.set(assetId, position);
    else this.positions.delete(assetId);
    if (locked) this.locked.add(assetId);
    else this.locked.delete(assetId);
    if (force && !moved) {
      this.revisions.set(assetId, this.revision(assetId) + 1);
    }
    this.keyed.notify(assetId);
  }

  /** This device dragged the asset to a world position. */
  moved(assetId: string, worldPosition: Vec3): void {
    [...this.moves].forEach((fn) => fn(assetId, worldPosition));
  }

  subscribeMoves(listener: StudioDragMoveListener): () => void {
    this.moves.add(listener);
    return () => {
      this.moves.delete(listener);
    };
  }

  /** Every asset back where the scene puts it, held by nobody. */
  reset(): void {
    if (this.positions.size === 0 && this.locked.size === 0) return;
    this.positions.clear();
    this.locked.clear();
    this.revisions.clear();
    this.keyed.notifyAll();
  }
}
