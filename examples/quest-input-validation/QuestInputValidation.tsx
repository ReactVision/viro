/**
 * Quest input validation scene. See README.md for what each log line should show.
 *
 * Mount <QuestInputValidation /> as a screen of a Quest build (xRMode: ["QUEST"]) and
 * read the output with:
 *
 *   adb shell setprop log.tag.ViroInput VERBOSE
 *   adb logcat -s ReactNativeJS ViroInput Viro VRLauncher
 */
import * as React from "react";
import {
  ViroAmbientLight,
  ViroAnimations,
  ViroARScene,
  ViroBox,
  ViroController,
  ViroText,
  ViroXRSceneNavigator,
} from "@reactvision/react-viro";

const TAG = "[QuestInputValidation]";

ViroAnimations.registerAnimations({
  questValidationSpin: { properties: { rotateY: "+=90" }, duration: 1000 },
});

const CLICK_STATES: Record<number, string> = { 1: "ClickDown", 2: "ClickUp", 3: "Clicked" };

// Sources a Quest controller reports: triggers, A/B/X/Y and the menu button.
const SOURCES: Record<number, string> = {
  1: "right trigger",
  3: "B",
  4: "left trigger",
  5: "A",
  6: "X",
  7: "Y",
  13: "menu",
};

let mounts = 0;

function ValidationScene() {
  const controller = React.useRef<ViroController>(null);
  const [renders, setRenders] = React.useState(0);
  const animationStarts = React.useRef(0);

  // Counts mounted scenes: one per headset view, also after leaving and re-entering.
  React.useEffect(() => {
    console.log(TAG, "scene mounted, now", ++mounts);
    return () => console.log(TAG, "scene unmounted, now", --mounts);
  }, []);

  // Asks for a ray in the same tick as mount and keeps asking, with no settling
  // delay. Every request must settle: the early ones reject with
  // E_CONTROLLER_NOT_READY, the later ones resolve.
  React.useEffect(() => {
    let live = true;
    const counts = { asked: 0, resolved: 0, notReady: 0, timedOut: 0, otherError: 0 };
    const ask = () => {
      if (!live) return;
      counts.asked++;
      const pending = controller.current?.getControllerRayAsync(1 as any);
      if (!pending) {
        counts.notReady++;
        setTimeout(ask, 0);
        return;
      }
      pending
        .then(() => counts.resolved++)
        .catch((error: { code?: string }) => {
          if (error?.code === "E_CONTROLLER_NOT_READY") counts.notReady++;
          else if (error?.code === "E_CONTROLLER_TIMEOUT") counts.timedOut++;
          else counts.otherError++;
        })
        .then(() => setTimeout(ask, 0));
    };
    ask();
    const report = setInterval(() => {
      const settled =
        counts.resolved + counts.notReady + counts.timedOut + counts.otherError;
      console.log(TAG, "rays", JSON.stringify(counts), "unsettled", counts.asked - settled);
    }, 2000);
    return () => {
      live = false;
      clearInterval(report);
    };
  }, []);

  // Re-renders the box 100 times with an inline, equal `animation` object.
  React.useEffect(() => {
    if (renders >= 100) {
      console.log(TAG, "100 re-renders done, animation starts:", animationStarts.current);
      return;
    }
    const t = setTimeout(() => setRenders(renders + 1), 50);
    return () => clearTimeout(t);
  }, [renders]);

  const logClick = (route: string) => (state: number, _position: unknown, source: number) =>
    console.log(
      TAG,
      "onClickState via",
      route,
      CLICK_STATES[state] ?? state,
      "source",
      source,
      SOURCES[source] ?? ""
    );

  return (
    <ViroARScene onClickState={logClick("ViroARScene") as any}>
      <ViroAmbientLight color="#ffffff" intensity={800} />
      <ViroController ref={controller} onClickState={logClick("ViroController") as any} />
      <ViroText
        text="Pull each trigger, then A, B, X, Y and menu: at this text, at the box, at nothing."
        position={[0, 0.4, -2]}
        width={3}
        height={1}
        style={{ fontSize: 16, color: "#ffffff", textAlign: "center" }}
      />
      {/* No handlers: a click on it must still reach ViroController. */}
      <ViroBox
        position={[0, -0.2, -1.5]}
        scale={[0.3, 0.3, 0.3]}
        animation={{ name: "questValidationSpin", run: true, loop: true }}
        onAnimationStart={() => animationStarts.current++}
      />
    </ViroARScene>
  );
}

export function QuestInputValidation() {
  return (
    <ViroXRSceneNavigator
      initialScene={{ scene: ValidationScene }}
      passthroughEnabled
      handTrackingEnabled
      handOcclusion
      onHandUpdate={(event) => {
        const { left, right } = event.nativeEvent;
        if (Math.random() < 0.01) {
          console.log(TAG, "onHandUpdate left", left != null, "right", right != null);
        }
      }}
    />
  );
}
