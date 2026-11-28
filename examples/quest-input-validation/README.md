# Quest input validation

A scene for checking, on a headset, the Quest input and session fixes in the `Unreleased` section of
the CHANGELOG. None of them could be run on a device where they were written, so this is the
check. It needs a Quest 3 and a build with `xRMode: ["QUEST"]`.

## Running it

Mount `QuestInputValidation` (from `QuestInputValidation.tsx`) as a screen of the app, then:

```sh
adb shell setprop log.tag.ViroInput VERBOSE
adb logcat -s ReactNativeJS ViroInput Viro VRLauncher
```

`ViroInput` is the bridge's trace of each click on its way to JavaScript. It is off unless that
property is set.

## What to look for

| Check | How | Expect |
|---|---|---|
| No crash at launch (`viroreact-controller-ray-before-attach`) | Launch 10 times. The scene asks for a ray in the same tick as it mounts. | No `NullPointerException` in `ControllerModule`. The `rays` line shows `notReady` above 0 from the first frames and then stops growing, while `resolved` climbs. |
| Every ray request settles (`viroreact-controller-ray-weak-callback`) | Leave it running for 5 minutes. For GC pressure, run `adb shell am send-trim-memory <package> RUNNING_CRITICAL` in a loop. | `unsettled` is 0 or 1 on every `rays` line, `timedOut` stays 0, and `resolved` passes 10,000. |
| An equal `animation` prop does not play again | Watch the first 5 seconds. | `100 re-renders done, animation starts: 1`, the box turns smoothly, and no `Unable to play animation` lines. |
| Clicks reach `ViroController` (`viroreact-quest-controller-click-route`) | Pull each trigger, then A, B, X, Y and menu, three times: aimed at nothing, at the box, at the text. Then leave to Home, re-enter and repeat. | For each press, `onClickState via ViroController` with ClickDown, ClickUp and Clicked and the right source: 1 right trigger, 4 left trigger, 5 A, 3 B, 6 X, 7 Y, 13 menu. **Not expected to pass on the bridge changes alone**: the cause is not known yet, and the menu button's route is in the renderer. Use the trace below to find where a click stops. |
| One scene per headset view | Enter, go Home, return and enter again quickly, 20 times. | `scene mounted, now 1` each time, never 2. One VRActivity in `adb shell dumpsys activity activities`. No crash. |
| `onHandUpdate` (`viroreact-quest-hand-update`) | Put the controllers down and show both hands. | `onHandUpdate left true right true` about once a second. **Not expected to pass yet**: see the CHANGELOG. |

## If a click does not reach `ViroController`

With `log.tag.ViroInput` set, each click that reaches the bridge logs three lines. The last one
present says where it stopped:

1. `ComponentEventDelegate.onClick source=… -> VRTController tag N`: the renderer delivered the click
   to the controller's delegate. **Absent: the click was lost in the renderer**, not in the bridge.
   With a renderer built from virocore#476 the lines before it say where: `OpenXR button edge`,
   then `presenter onClick … -> controller delegate` (or `dropped: …` with the reason), then
   `EventDelegate onClick … -> Java`.
2. `ViroEventEmitter onClickViro tag N dispatched`: handed to React Native. `dropped: …` here means
   the view's tag did not resolve.
3. `onClickState via ViroController` from JavaScript.

`VRTController [tag N, …] setViroContext`, `canClick=` and `onTearDown` lines show when the
delegate was set, whether clicks were enabled on it, and whether it was disposed while mounted. A
`replaces … as the receiver of controller events` warning means two `ViroController`s are mounted
under one navigator, and only the newer one receives events.
