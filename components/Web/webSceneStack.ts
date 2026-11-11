/**
 * Scene history for the web scene navigators, with the native navigators'
 * semantics: scenes are keyed by tag (a random one when none is given),
 * `push("tag")` re-shows a scene pushed earlier under that tag, `jump` moves a
 * tag's last entry to the top instead of stacking it again, `replace` swaps the
 * top, and the root is never popped (popN refuses outright, as native does).
 *
 * Each function takes the history and returns the next one, or the same array
 * when the call is refused, so it can be a React state updater.
 */
import type * as React from "react";

export type WebSceneEntry = {
  key: string;
  scene: React.ComponentType<any>;
  passProps?: Record<string, unknown>;
};

type SceneArg = { scene: React.ComponentType<any>; passProps?: Record<string, unknown> };

let tagCounter = 0;
const newTag = () => `web-scene-${++tagCounter}`;

/** Resolves native's (tag), (tag, scene) and (scene) call forms against the history. */
function resolve(
  history: WebSceneEntry[],
  param1: unknown,
  param2: unknown,
): WebSceneEntry | null {
  const tag = typeof param1 === "string" && param1.trim() ? param1 : null;
  const arg = (typeof param1 === "string" ? param2 : param1) as SceneArg | undefined;
  if (arg?.scene) return { key: tag ?? newTag(), scene: arg.scene, passProps: arg.passProps };
  if (!tag) return null;
  const known = [...history].reverse().find((e) => e.key === tag);
  return known ? { ...known } : null;
}

export function pushScene(history: WebSceneEntry[], param1?: unknown, param2?: unknown): WebSceneEntry[] {
  const entry = resolve(history, param1, param2);
  return entry ? [...history, entry] : history;
}

export function replaceScene(history: WebSceneEntry[], param1?: unknown, param2?: unknown): WebSceneEntry[] {
  const entry = resolve(history, param1, param2);
  return entry ? [...history.slice(0, -1), entry] : history;
}

export function jumpToScene(history: WebSceneEntry[], param1?: unknown, param2?: unknown): WebSceneEntry[] {
  const entry = resolve(history, param1, param2);
  if (!entry) return history;
  let at = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].key === entry.key) {
      at = i;
      break;
    }
  }
  const rest = at >= 0 ? [...history.slice(0, at), ...history.slice(at + 1)] : history;
  return [...rest, entry];
}

export function popScenes(history: WebSceneEntry[], n = 1): WebSceneEntry[] {
  if (n <= 0 || history.length - n <= 0) return history;
  return history.slice(0, history.length - n);
}
