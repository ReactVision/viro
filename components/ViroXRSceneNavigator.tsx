import * as React from "react";
import { ViewProps } from "react-native";
import { ViroARSceneNavigator } from "./AR/ViroARSceneNavigator";
import { ViroVRSceneNavigator } from "./ViroVRSceneNavigator";
import { isQuest } from "./Utilities/ViroPlatform";

type SceneFactory = { scene: () => React.JSX.Element };

type Props = ViewProps & {
  /**
   * Scene used on both AR and VR platforms when no platform-specific scene is provided.
   * Most apps want a different scene per platform — pass `arInitialScene` and
   * `vrInitialScene` instead in that case.
   */
  initialScene?: SceneFactory;

  /** Scene mounted on iOS / non-Quest Android (rendered via ViroARSceneNavigator). */
  arInitialScene?: SceneFactory;

  /** Scene mounted on Meta Quest (rendered via ViroVRSceneNavigator). */
  vrInitialScene?: SceneFactory;

  // ── Forwarded to ViroARSceneNavigator ──────────────────────────────────────
  worldAlignment?: "Gravity" | "GravityAndHeading" | "Camera";
  autofocus?: boolean;
  videoQuality?: "High" | "Low";
  numberOfTrackedImages?: number;

  // ── Forwarded to ViroVRSceneNavigator ──────────────────────────────────────
  vrModeEnabled?: boolean;
  onExitViro?: () => void;

  // ── Common ─────────────────────────────────────────────────────────────────
  viroAppProps?: any;
  hdrEnabled?: boolean;
  pbrEnabled?: boolean;
  bloomEnabled?: boolean;
  shadowsEnabled?: boolean;
  multisamplingEnabled?: boolean;
  debug?: boolean;
};

/**
 * Cross-reality scene navigator. Picks the right underlying navigator at runtime:
 *
 *  - **Meta Quest** → `ViroVRSceneNavigator`
 *  - **iOS / non-Quest Android** → `ViroARSceneNavigator`
 *
 * Pass `arInitialScene` / `vrInitialScene` when the AR and VR scenes differ.
 * When only `initialScene` is provided it is used for both modes.
 */
export const ViroXRSceneNavigator = React.forwardRef<unknown, Props>(
  function ViroXRSceneNavigator(props, ref) {
    const {
      initialScene,
      arInitialScene,
      vrInitialScene,
      ...rest
    } = props;

    if (isQuest) {
      const scene = vrInitialScene ?? initialScene;
      if (!scene) {
        console.warn(
          "[Viro] ViroXRSceneNavigator on Quest requires `vrInitialScene` or `initialScene`."
        );
        return null;
      }
      return (
        <ViroVRSceneNavigator
          ref={ref as React.Ref<ViroVRSceneNavigator>}
          initialScene={scene}
          {...rest}
        />
      );
    }

    const scene = arInitialScene ?? initialScene;
    if (!scene) {
      console.warn(
        "[Viro] ViroXRSceneNavigator requires `arInitialScene` or `initialScene`."
      );
      return null;
    }
    return (
      <ViroARSceneNavigator
        ref={ref as React.Ref<ViroARSceneNavigator>}
        initialScene={scene}
        {...rest}
      />
    );
  }
);
