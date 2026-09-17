/**
 * The frame a ViroFlexView measured for one of its children.
 *
 * Native pushes the same two things onto a laid-out child — a position and a
 * size — from VRTNode's recalcLayout. Position is applied by the container here
 * (it wraps each child in a node it owns), so what travels through the context
 * is the size, which only the child itself can act on: a quad, an image and a
 * text block each rebuild different geometry from it.
 *
 * Null outside a ViroFlexView, which is the common case: a child then keeps the
 * width and height it was written with.
 */
import { createContext, useContext } from "react";

export type ViroFlexSlot = {
  /** Metres. */
  width: number;
  height: number;
};

export const ViroFlexSlotContext = createContext<ViroFlexSlot | null>(null);

export function useViroFlexSlot(): ViroFlexSlot | null {
  return useContext(ViroFlexSlotContext);
}
