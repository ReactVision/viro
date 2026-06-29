import * as React from "react";
import { NativeSyntheticEvent } from "react-native";
import { ViroErrorEvent } from "../../Types/ViroEvents";
import { ViroSound } from "../../ViroSound";
import { ViroSpatialSound } from "../../ViroSpatialSound";
import { StudioSoundManager } from "./soundManager";

/**
 * Renders every actively-playing sound from the manager, re-painting the whole
 * list on any change (like the reactive variable-text nodes). Non-looping sounds
 * remove themselves on finish; any sound removes itself on error so a clip that
 * fails to load releases a waiting step instead of stalling the sequence.
 */
export const StudioSounds: React.FC<{ manager: StudioSoundManager }> = ({
  manager,
}) => {
  const [, force] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => manager.subscribe(force), [manager]);
  return (
    <>
      {manager.getActive().map((s) => {
        const shared = {
          source: { uri: s.url },
          volume: s.volume,
          loop: s.loop,
          paused: false,
          onFinish: () => {
            if (!s.loop) manager.remove(s.playId);
          },
          onError: (e: NativeSyntheticEvent<ViroErrorEvent>) => {
            console.warn(
              `[Studio] Sound failed: ${s.audioAssetId} (#${s.playId})`,
              e?.nativeEvent?.error
            );
            manager.remove(s.playId);
          },
        };
        return s.position ? (
          <ViroSpatialSound key={s.playId} position={s.position} {...shared} />
        ) : (
          <ViroSound key={s.playId} {...shared} />
        );
      })}
    </>
  );
};
