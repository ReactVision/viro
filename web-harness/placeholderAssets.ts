/**
 * Placeholder assets shared by main.tsx (the interactive demo) and render.tsx
 * (the headless render entry). render.tsx's require() shim hands these back
 * for any local `require('./assets/...')` in caller-supplied TSX, since the
 * files those paths point to don't exist in this harness.
 */
import helmetUrl from "./models/DamagedHelmet.glb?url";

export function makeCheckerDataUrl(): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const cells = 8;
  const s = canvas.width / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#ffffff" : "#3399ff";
      ctx.fillRect(x * s, y * s, s, s);
    }
  }
  return canvas.toDataURL();
}

export const PLACEHOLDER_MODEL_URL = helmetUrl;
