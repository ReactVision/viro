import { ViroEventSource, type ViroSource } from "../../Types/ViroUtils";
import { isQuest } from "../../Utilities/ViroPlatform";

/**
 * Whether a click is a select. On Quest, a ViroController and every node with
 * a click handler hear every button (A, B, X, Y, the grips), so only the
 * triggers and pinches count. A phone tap has one source.
 */
export function isSelectClick(source: ViroSource): boolean {
  if (!isQuest) return true;
  const id = source as unknown as number;
  return (
    id === ViroEventSource.CONTROLLER || id === ViroEventSource.LEFT_CONTROLLER
  );
}
