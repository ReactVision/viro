/**
 * The Quest opening scene's data, which reaches VRActivity after it launched.
 * What is tested here: only the navigator that opened last writes, Retry shows
 * loading before it refetches, and a closing navigator leaves the scene it
 * opened as it is.
 */
import {
  QUEST_SCENE_LOADING,
  questSceneLoadStore,
} from "../components/Studio/domain/questSceneLoadStore";
import type { StudioSceneResponse } from "../components/Studio/types";

const sceneData = {
  scene: { id: "s1" },
  assets: [],
} as unknown as StudioSceneResponse;

test("opening starts at loading and takes the opener's writes", () => {
  const owner = {};
  questSceneLoadStore.open(owner, jest.fn());
  expect(questSceneLoadStore.get()).toBe(QUEST_SCENE_LOADING);
  questSceneLoadStore.set(owner, { status: "ready", sceneData });
  expect(questSceneLoadStore.get()).toEqual({ status: "ready", sceneData });
});

test("an older navigator's writes are ignored", () => {
  const older = {};
  const newer = {};
  questSceneLoadStore.open(older, jest.fn());
  questSceneLoadStore.open(newer, jest.fn());
  questSceneLoadStore.set(older, { status: "failed" });
  expect(questSceneLoadStore.get()).toBe(QUEST_SCENE_LOADING);
});

test("retry shows loading, then refetches", () => {
  const owner = {};
  const retry = jest.fn(() =>
    expect(questSceneLoadStore.get()).toBe(QUEST_SCENE_LOADING)
  );
  questSceneLoadStore.open(owner, retry);
  questSceneLoadStore.set(owner, { status: "failed" });
  const listener = jest.fn();
  const unsubscribe = questSceneLoadStore.subscribe(listener);
  questSceneLoadStore.retry();
  unsubscribe();
  expect(retry).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledTimes(1);
});

test("closing keeps the scene shown and drops the retry", () => {
  const owner = {};
  const retry = jest.fn();
  questSceneLoadStore.open(owner, retry);
  questSceneLoadStore.set(owner, { status: "ready", sceneData });
  const listener = jest.fn();
  const unsubscribe = questSceneLoadStore.subscribe(listener);
  questSceneLoadStore.close(owner);
  questSceneLoadStore.retry();
  questSceneLoadStore.set(owner, { status: "failed" });
  unsubscribe();
  expect(listener).not.toHaveBeenCalled();
  expect(retry).not.toHaveBeenCalled();
  expect(questSceneLoadStore.get()).toEqual({ status: "ready", sceneData });
});
