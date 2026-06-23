import * as React from "react";
import { ViroSound } from "../../ViroSound";
import { ViroSpatialSound } from "../../ViroSpatialSound";
import { StudioSoundManager } from "./soundManager";

/**
 * Renders every actively-playing sound from the manager. Subscribes to the
 * manager and force-renders on change (the whole list re-paints, like the
 * reactive variable-text nodes). A positioned PLAY uses ViroSpatialSound;
 * otherwise a non-spatial ViroSound. Non-looping sounds remove themselves
 * from the manager on finish.
 */
export const StudioSounds: React.FC<{ manager: StudioSoundManager }> = ({
  manager,
}) => {
  const [, force] = React.useReducer((n) => n + 1, 0);
  React.useEffect(() => manager.subscribe(force), [manager]);
  return (
    <>
      {manager.getActive().map((s) =>
        s.position ? (
          <ViroSpatialSound
            key={s.playId}
            source={{ uri: s.url }}
            position={s.position}
            volume={s.volume}
            loop={s.loop}
            paused={false}
            onFinish={() => {
              if (!s.loop) manager.remove(s.playId);
            }}
          />
        ) : (
          <ViroSound
            key={s.playId}
            source={{ uri: s.url }}
            volume={s.volume}
            loop={s.loop}
            paused={false}
            onFinish={() => {
              if (!s.loop) manager.remove(s.playId);
            }}
          />
        )
      )}
    </>
  );
};
